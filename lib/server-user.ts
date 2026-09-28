import { cookies } from "next/headers";

export const USER_COOKIE_KEY = "flashai_user_id";

export async function getServerUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get(USER_COOKIE_KEY);
    return userCookie?.value ?? null;
  } catch {
    return null;
  }
}
