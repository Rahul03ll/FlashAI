import { z } from "zod";

export const USER_STORAGE_KEY = "flashai_user_id";
export const AUTH_STORAGE_KEY = "flashai_auth_token";

export interface ClientUserProfile {
  id: string;
  name: string;
  displayName: string | null;
  email: string | null;
  isGuest: boolean;
  xp: number;
  streak: number;
  level: "Beginner" | "Learner" | "Master";
  points: number;
}

export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") {
    return "local-user";
  }

  // Check localStorage first, fallback to cookie
  let existing = localStorage.getItem(USER_STORAGE_KEY) || getCookie(USER_STORAGE_KEY);
  if (existing) {
    localStorage.setItem(USER_STORAGE_KEY, existing);
    setCookie(USER_STORAGE_KEY, existing);
    return existing;
  }

  const created = `user-${crypto.randomUUID()}`;
  localStorage.setItem(USER_STORAGE_KEY, created);
  setCookie(USER_STORAGE_KEY, created);
  return created;
}

export function switchLocalUserId(newUserId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_STORAGE_KEY, newUserId);
  setCookie(USER_STORAGE_KEY, newUserId);
}

export function setClientAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, token);
  setCookie(AUTH_STORAGE_KEY, token, 30);
}

export function clearClientAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  deleteCookie(AUTH_STORAGE_KEY);
}

const bootstrapResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().optional(),
    displayName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    isGuest: z.boolean().optional(),
    xp: z.number().default(0),
    streak: z.number().default(0),
    level: z.enum(["Beginner", "Learner", "Master"]),
    points: z.number().default(0),
  }),
});

export async function bootstrapUser(): Promise<ClientUserProfile> {
  // First, check if we have a valid authenticated session from /api/auth/me
  try {
    const authRes = await fetch("/api/auth/me", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (authRes.ok) {
      const authData = await authRes.json();
      if (authData.success && authData.user) {
        const u = authData.user;
        switchLocalUserId(u.id);
        return {
          id: u.id,
          name: u.name ?? `Learner-${u.id.slice(-4).toUpperCase()}`,
          displayName: u.displayName ?? null,
          email: u.email ?? null,
          isGuest: u.isGuest ?? false,
          xp: u.xp ?? 0,
          streak: u.streak ?? 0,
          level: u.level ?? "Beginner",
          points: u.points ?? 0,
        };
      }
    }
  } catch {
    // continue to bootstrap guest
  }

  const userId = getOrCreateLocalUserId();
  const response = await fetch("/api/user/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Failed to initialize user.");
  const parsed = bootstrapResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid bootstrap response.");
  const user = parsed.data.user;
  return {
    id: user.id,
    name: user.name ?? `Learner-${user.id.slice(-4).toUpperCase()}`,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    isGuest: user.isGuest ?? true,
    xp: user.xp,
    streak: user.streak,
    level: user.level,
    points: user.points,
  };
}

export async function logoutClient(): Promise<string> {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    clearClientAuthSession();
    const newGuestId = data.newGuestId || `user-${crypto.randomUUID()}`;
    switchLocalUserId(newGuestId);
    return newGuestId;
  } catch {
    clearClientAuthSession();
    const newGuestId = `user-${crypto.randomUUID()}`;
    switchLocalUserId(newGuestId);
    return newGuestId;
  }
}
