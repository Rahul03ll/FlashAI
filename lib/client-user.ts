import { z } from "zod";

const USER_STORAGE_KEY = "flashai_user_id";

export function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") {
    return "local-user";
  }

  const existing = localStorage.getItem(USER_STORAGE_KEY);
  if (existing) return existing;

  const created = `user-${crypto.randomUUID()}`;
  localStorage.setItem(USER_STORAGE_KEY, created);
  return created;
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
    displayName: user.displayName ?? user.name ?? null,
    xp: user.xp,
    streak: user.streak,
    level: user.level,
    points: user.points,
  };
}
