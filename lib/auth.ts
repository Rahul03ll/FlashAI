import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/gamification";

export interface AuthUser {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
  isGuest: boolean;
  points: number;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
}

export interface VerificationRecord {
  id: string;
  email: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
  attempts: number;
}

export interface SessionPayload {
  userId: string;
  email: string | null;
  isGuest: boolean;
  iat: number;
  exp: number;
}

export const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_VERIFY_ATTEMPTS = 3;
export const SEND_CODE_MAX_REQUESTS = 3;
export const SEND_CODE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const AUTH_COOKIE_NAME = "flashai_auth_token";
export const USER_COOKIE_KEY = "flashai_user_id";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "flashai-sp-secret-auth-key-2026-production-salt";

// In-Memory Fallback Stores for offline/development resilience
interface MemoryUser extends AuthUser {
  updatedAt: Date;
}

interface MemoryDeck {
  id: string;
  userId: string | null;
}

const memoryVerificationCodes = new Map<string, VerificationRecord>();
const memorySendCodeTimestamps = new Map<string, number[]>();
const memoryUsers = new Map<string, MemoryUser>();
const memoryDecks = new Map<string, MemoryDeck>();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtp(): string {
  // Cryptographically secure 6-digit number between 100000 and 999999
  const n = crypto.randomInt(100000, 1000000);
  return n.toString();
}

/**
 * Reset memory stores (primarily for testing and test isolation)
 */
export function resetAuthStore(): void {
  memoryVerificationCodes.clear();
  memorySendCodeTimestamps.clear();
  memoryUsers.clear();
  memoryDecks.clear();
}

/**
 * Check and record rate limit for sending verification code to an email.
 * Sliding window: max 3 attempts per 10 minutes.
 */
export function checkSendCodeRateLimit(email: string): {
  allowed: boolean;
  remaining: number;
  resetMs: number;
} {
  const normEmail = normalizeEmail(email);
  const now = Date.now();
  const timestamps = (memorySendCodeTimestamps.get(normEmail) || []).filter(
    (ts) => now - ts < SEND_CODE_WINDOW_MS
  );

  if (timestamps.length >= SEND_CODE_MAX_REQUESTS) {
    const oldest = timestamps[0];
    const resetMs = Math.max(0, oldest + SEND_CODE_WINDOW_MS - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  timestamps.push(now);
  memorySendCodeTimestamps.set(normEmail, timestamps);

  return {
    allowed: true,
    remaining: SEND_CODE_MAX_REQUESTS - timestamps.length,
    resetMs: SEND_CODE_WINDOW_MS,
  };
}

function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Store a newly generated verification code (tries Prisma, falls back to memory)
 * Invalidates any prior unverified codes for this email to reset attempt counts.
 */
export async function storeVerificationCode(
  email: string,
  code: string
): Promise<VerificationRecord> {
  const normEmail = normalizeEmail(email);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  const createdAt = new Date();
  const id = crypto.randomUUID();

  // Invalidate any prior unverified codes for this email in memory store
  for (const [key, rec] of memoryVerificationCodes.entries()) {
    if (rec.email === normEmail) {
      memoryVerificationCodes.delete(key);
    }
  }

  // Invalidate any prior unverified codes for this email in database if available
  if (isDbAvailable()) {
    try {
      await prisma.verificationCode.deleteMany({
        where: { email: normEmail },
      });
    } catch {
      // Database offline or unavailable; fallback memory handled above
    }
  }

  const record: VerificationRecord = {
    id,
    email: normEmail,
    code,
    expiresAt,
    createdAt,
    attempts: 0,
  };

  // Always keep in memory store
  memoryVerificationCodes.set(id, record);

  if (!isDbAvailable()) {
    return record;
  }

  try {
    const dbRecord = await prisma.verificationCode.create({
      data: {
        id,
        email: normEmail,
        code,
        expiresAt,
        createdAt,
        attempts: 0,
      },
    });
    return {
      id: dbRecord.id,
      email: dbRecord.email,
      code: dbRecord.code,
      expiresAt: dbRecord.expiresAt,
      createdAt: dbRecord.createdAt,
      attempts: dbRecord.attempts,
    };
  } catch {
    // Database unavailable or offline; in-memory store serves as source of truth
    return record;
  }
}

/**
 * Helper to map raw user object to typed AuthUser
 */
function toAuthUser(raw: {
  id: string;
  name: string;
  displayName: string | null;
  email?: string | null;
  isGuest?: boolean;
  points?: number;
  xp?: number;
  streak?: number;
}): AuthUser {
  const points = raw.points ?? 0;
  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName ?? null,
    email: raw.email ? normalizeEmail(raw.email) : null,
    isGuest: raw.isGuest ?? true,
    points,
    xp: raw.xp ?? 0,
    streak: raw.streak ?? 0,
    level: getLevel(points),
  };
}

export async function findUserById(userId: string): Promise<AuthUser | null> {
  if (isDbAvailable()) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (dbUser) {
        return toAuthUser(dbUser);
      }
    } catch {
      // fallback to memory
    }
  }

  const mem = memoryUsers.get(userId);
  return mem ? toAuthUser(mem) : null;
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const normEmail = normalizeEmail(email);
  if (isDbAvailable()) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: normEmail },
      });
      if (dbUser) {
        return toAuthUser(dbUser);
      }
    } catch {
      // fallback to memory
    }
  }

  for (const mem of memoryUsers.values()) {
    if (mem.email && normalizeEmail(mem.email) === normEmail) {
      return toAuthUser(mem);
    }
  }
  return null;
}

/**
 * Create or save memory user
 */
export function saveMemoryUser(user: Partial<AuthUser> & { id: string }): AuthUser {
  const existing = memoryUsers.get(user.id);
  const updated: MemoryUser = {
    id: user.id,
    name: user.name ?? existing?.name ?? `Learner-${user.id.slice(-4).toUpperCase()}`,
    displayName: user.displayName !== undefined ? user.displayName : existing?.displayName ?? null,
    email: user.email !== undefined ? (user.email ? normalizeEmail(user.email) : null) : existing?.email ?? null,
    isGuest: user.isGuest !== undefined ? user.isGuest : existing?.isGuest ?? true,
    points: user.points ?? existing?.points ?? 0,
    xp: user.xp ?? existing?.xp ?? 0,
    streak: user.streak ?? existing?.streak ?? 0,
    level: getLevel(user.points ?? existing?.points ?? 0),
    updatedAt: new Date(),
  };
  memoryUsers.set(user.id, updated);
  return toAuthUser(updated);
}

/**
 * Register deck in memory for fallback merging
 */
export function registerMemoryDeck(deckId: string, userId: string | null) {
  memoryDecks.set(deckId, { id: deckId, userId });
}

/**
 * Generate a cryptographically signed session token
 */
export function createSessionToken(payload: {
  userId: string;
  email?: string | null;
  isGuest?: boolean;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 24 * 60 * 60; // 30 days
  const session: SessionPayload = {
    userId: payload.userId,
    email: payload.email ? normalizeEmail(payload.email) : null,
    isGuest: payload.isGuest ?? false,
    iat: now,
    exp,
  };

  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

/**
 * Verify session token and return parsed payload
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(data)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    );

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validates a verification code, links email to user, and performs account merging if an
 * account with the same email already exists.
 */
export async function verifyCodeAndLinkAccount(params: {
  email: string;
  code: string;
  currentUserId?: string;
}): Promise<{
  success: boolean;
  user?: AuthUser;
  token?: string;
  isMerged?: boolean;
  error?: string;
}> {
  const normEmail = normalizeEmail(params.email);
  const inputCode = params.code.trim();
  const currentUserId = params.currentUserId?.trim() || `user-${crypto.randomUUID()}`;
  const now = new Date();

  // 1. Fetch active verification codes for this email
  let activeCodes: VerificationRecord[] = [];

  if (isDbAvailable()) {
    try {
      const dbCodes = await prisma.verificationCode.findMany({
        where: {
          email: normEmail,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      });
      activeCodes = dbCodes.map((c) => ({
        id: c.id,
        email: c.email,
        code: c.code,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        attempts: c.attempts,
      }));
    } catch {
      // fallback to memory
    }
  }

  // Also include in-memory codes if DB was empty or failed
  if (activeCodes.length === 0) {
    for (const rec of memoryVerificationCodes.values()) {
      if (
        rec.email === normEmail &&
        rec.expiresAt.getTime() > now.getTime()
      ) {
        activeCodes.push({ ...rec });
      }
    }
    activeCodes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  if (activeCodes.length === 0) {
    return {
      success: false,
      error: "No active verification code found for this email, or code has expired.",
    };
  }

  // Find the matching code or check the latest code
  const candidate = activeCodes[0];

  if (candidate.attempts >= MAX_VERIFY_ATTEMPTS) {
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
    };
  }

  if (candidate.code !== inputCode) {
    const newAttempts = candidate.attempts + 1;
    // update attempts in db if available
    if (isDbAvailable()) {
      try {
        await prisma.verificationCode.update({
          where: { id: candidate.id },
          data: { attempts: newAttempts },
        });
      } catch {
        // ignore
      }
    }
    // update in memory
    const memRec = memoryVerificationCodes.get(candidate.id);
    if (memRec) {
      memRec.attempts = newAttempts;
    }

    const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;
    return {
      success: false,
      error:
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : "Invalid code. Maximum attempts reached. Please request a new code.",
    };
  }

  // 2. Code is valid! Consume/invalidate it
  if (isDbAvailable()) {
    try {
      await prisma.verificationCode.delete({
        where: { id: candidate.id },
      });
    } catch {
      try {
        await prisma.verificationCode.update({
          where: { id: candidate.id },
          data: { expiresAt: new Date(0) },
        });
      } catch {
        // ignore
      }
    }
  }
  memoryVerificationCodes.delete(candidate.id);

  // 3. User Linking and Merging
  const existingUser = await findUserByEmail(normEmail);
  const currentUser = await findUserById(currentUserId);

  let finalUser: AuthUser | null = null;
  let isMerged = false;

  if (existingUser && existingUser.id !== currentUserId) {
    // MERGE SCENARIO: An account already exists with this email!
    // Transfer decks and stats from the guest (currentUserId) to the existing account.
    isMerged = true;
    const mergedXp = (existingUser.xp || 0) + (currentUser?.xp || 0);
    const mergedPoints = (existingUser.points || 0) + (currentUser?.points || 0);
    const mergedStreak = Math.max(existingUser.streak || 0, currentUser?.streak || 0);

    let updatedFromDb = false;
    if (isDbAvailable()) {
      try {
        // 1. Reassign decks
        await prisma.deck.updateMany({
          where: { userId: currentUserId },
          data: { userId: existingUser.id },
        });

        // 2. Update existing user
        const updatedDbUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            xp: mergedXp,
            points: mergedPoints,
            streak: mergedStreak,
            isGuest: false,
          },
        });

        finalUser = toAuthUser(updatedDbUser);
        updatedFromDb = true;
      } catch {
        // In-memory fallback
      }
    }

    if (!updatedFromDb) {
      for (const [deckId, deck] of memoryDecks.entries()) {
        if (deck.userId === currentUserId) {
          memoryDecks.set(deckId, { ...deck, userId: existingUser.id });
        }
      }
      finalUser = saveMemoryUser({
        ...existingUser,
        xp: mergedXp,
        points: mergedPoints,
        streak: mergedStreak,
        isGuest: false,
      });
    }
  } else if (existingUser && existingUser.id === currentUserId) {
    // Already matches
    let updatedFromDb = false;
    if (isDbAvailable()) {
      try {
        const updated = await prisma.user.update({
          where: { id: existingUser.id },
          data: { isGuest: false },
        });
        finalUser = toAuthUser(updated);
        updatedFromDb = true;
      } catch {
        // fallback
      }
    }
    if (!updatedFromDb) {
      finalUser = saveMemoryUser({
        ...existingUser,
        isGuest: false,
      });
    }
  } else {
    // NEW EMAIL LINK: Current guest user is linked with this email
    const baseName = normEmail.split("@")[0];
    const initialName = currentUser?.name || `Learner-${currentUserId.slice(-4).toUpperCase()}`;
    let updatedFromDb = false;

    if (isDbAvailable()) {
      try {
        const updated = await prisma.user.upsert({
          where: { id: currentUserId },
          update: {
            email: normEmail,
            isGuest: false,
          },
          create: {
            id: currentUserId,
            name: baseName || initialName,
            email: normEmail,
            isGuest: false,
            xp: currentUser?.xp ?? 0,
            points: currentUser?.points ?? 0,
            streak: currentUser?.streak ?? 0,
          },
        });
        finalUser = toAuthUser(updated);
        updatedFromDb = true;
      } catch {
        // fallback
      }
    }

    if (!updatedFromDb) {
      finalUser = saveMemoryUser({
        id: currentUserId,
        name: currentUser?.name || baseName || `Learner-${currentUserId.slice(-4).toUpperCase()}`,
        email: normEmail,
        isGuest: false,
        xp: currentUser?.xp ?? 0,
        points: currentUser?.points ?? 0,
        streak: currentUser?.streak ?? 0,
      });
    }
  }

  const resolvedUser: AuthUser =
    finalUser ||
    saveMemoryUser({
      id: currentUserId,
      name: `Learner-${currentUserId.slice(-4).toUpperCase()}`,
      email: normEmail,
      isGuest: false,
    });

  // 4. Issue session token
  const token = createSessionToken({
    userId: resolvedUser.id,
    email: resolvedUser.email,
    isGuest: false,
  });

  return {
    success: true,
    user: resolvedUser,
    token,
    isMerged,
  };
}

/**
 * Server session resolution helper for route handlers and server components.
 * Resolves session from either Authorization header or cookies.
 */
export async function getSessionUser(request?: Request): Promise<AuthUser | null> {
  let authToken: string | null = null;
  let userIdCookie: string | null = null;

  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      authToken = authHeader.slice(7).trim();
    }

    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const matchAuth = cookieHeader.match(new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`));
      if (matchAuth) authToken = decodeURIComponent(matchAuth[1]);

      const matchUser = cookieHeader.match(new RegExp(`(?:^|; )${USER_COOKIE_KEY}=([^;]*)`));
      if (matchUser) userIdCookie = decodeURIComponent(matchUser[1]);
    }
  } else {
    try {
      const cookieStore = await cookies();
      authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
      userIdCookie = cookieStore.get(USER_COOKIE_KEY)?.value ?? null;
    } catch {
      // Next.js cookies() failed or called outside request context
    }
  }

  if (authToken) {
    const session = verifySessionToken(authToken);
    if (session) {
      const user = await findUserById(session.userId);
      if (user) {
        return user;
      }
      // If user not found in DB (e.g. wiped or fallback), return reconstructed user from session
      return {
        id: session.userId,
        name: session.email ? session.email.split("@")[0] : `Learner-${session.userId.slice(-4)}`,
        displayName: null,
        email: session.email ? normalizeEmail(session.email) : null,
        isGuest: session.isGuest,
        points: 0,
        xp: 0,
        streak: 0,
        level: "Beginner",
      };
    }
  }

  if (userIdCookie) {
    const guestUser = await findUserById(userIdCookie);
    if (guestUser) return guestUser;

    return {
      id: userIdCookie,
      name: `Learner-${userIdCookie.slice(-4).toUpperCase()}`,
      displayName: null,
      email: null,
      isGuest: true,
      points: 0,
      xp: 0,
      streak: 0,
      level: "Beginner",
    };
  }

  return null;
}
