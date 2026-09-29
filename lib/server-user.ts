import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  USER_COOKIE_KEY,
  verifySessionToken,
  getSessionUser,
  type AuthUser,
} from "@/lib/auth";

export { USER_COOKIE_KEY, AUTH_COOKIE_NAME };

/**
 * Resolves the active user ID on the server side:
 * 1. Checks verified auth session token (`flashai_auth_token`)
 * 2. Falls back to guest user cookie (`flashai_user_id`)
 */
export async function getServerUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();

    // Check signed auth session token first
    const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (authToken) {
      const session = verifySessionToken(authToken);
      if (session?.userId) {
        return session.userId;
      }
    }

    // Fall back to guest cookie
    const userCookie = cookieStore.get(USER_COOKIE_KEY);
    return userCookie?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the full active user profile on the server side
 */
export async function getServerUser(): Promise<AuthUser | null> {
  return getSessionUser();
}
