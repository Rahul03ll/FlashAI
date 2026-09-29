import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyCodeAndLinkAccount,
  AUTH_COOKIE_NAME,
  USER_COOKIE_KEY,
} from "@/lib/auth";

const verifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address format"),
  code: z
    .string()
    .trim()
    .min(4, "Verification code is too short")
    .max(8, "Verification code is too long"),
  currentUserId: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = verifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload." },
        { status: 400 }
      );
    }

    const { email, code, currentUserId } = parsed.data;

    const result = await verifyCodeAndLinkAccount({
      email,
      code,
      currentUserId,
    });

    if (!result.success || !result.user || !result.token) {
      return NextResponse.json(
        { error: result.error || "Verification failed." },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        user: result.user,
        token: result.token,
        isMerged: result.isMerged ?? false,
        message: result.isMerged
          ? "Accounts merged successfully! All decks and stats are unified."
          : "Account linked successfully!",
      },
      { status: 200 }
    );

    // Set secure auth session cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Also sync the flashai_user_id cookie to the resolved account id
    response.cookies.set({
      name: USER_COOKIE_KEY,
      value: result.user.id,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
