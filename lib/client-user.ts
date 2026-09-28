import { z } from "zod";

export const USER_STORAGE_KEY = "flashai_user_id";

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
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

const bootstrapResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().optional(),
    displayName: z.string().nullable().optional(),
    xp: z.number().default(0),
    streak: z.number().default(0),
    level: z.enum(["Beginner", "Learner", "Master"]),
    points: z.number().default(0),
  }),
});

export async function bootstrapUser() {
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
    xp: user.xp,
    streak: user.streak,
    level: user.level,
    points: user.points,
  };
}
