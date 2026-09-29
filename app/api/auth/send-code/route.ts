import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateOtp,
  storeVerificationCode,
  checkSendCodeRateLimit,
  normalizeEmail,
} from "@/lib/auth";

const sendCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address format"),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = sendCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email payload." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);

    // Rate limit check: max 3 requests per email per 10 minutes
    const rateLimit = checkSendCodeRateLimit(email);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.resetMs / 1000);
      return NextResponse.json(
        {
          error: "Too many verification code requests. Please try again shortly.",
          retryAfter: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSec.toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Generate secure 6-digit OTP code
    const code = generateOtp();

    // Store in database and memory fallback with 10-minute expiry
    await storeVerificationCode(email, code);

    // In development mode or test environments, log the code for frictionless testing
    if (process.env.NODE_ENV !== "production") {
      console.log(`[FlashAI Auth] Verification code for ${email}: ${code}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent successfully.",
        // Include devCode when not running in production so tests and dev UI can auto-fill
        ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
