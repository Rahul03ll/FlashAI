import { NextResponse } from "next/server";
import crypto from "crypto";
import { AUTH_COOKIE_NAME, USER_COOKIE_KEY } from "@/lib/auth";

export async function POST() {
  try {
    const newGuestId = `user-${crypto.randomUUID()}`;

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully. Reverted to fresh guest profile.",
      newGuestId,
    });

    // Clear auth session cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    // Set new guest user cookie
    response.cookies.set({
      name: USER_COOKIE_KEY,
      value: newGuestId,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
