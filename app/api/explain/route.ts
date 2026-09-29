import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBetterExplanation } from "@/lib/groq";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { globalAiQueue } from "@/lib/ai-queue";

export const runtime = "nodejs";

const explainSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateCheck = checkRateLimit(`explain:${clientIp}`, 10, 60_000);
    const headers = getRateLimitHeaders(rateCheck, 10);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many AI explanation requests. Please wait a moment before trying again.",
          retryAfter: rateCheck.retryAfterSec,
        },
        {
          status: 429,
          headers,
        }
      );
    }

    const body: unknown = await request.json();
    const parsed = explainSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const explanation = await globalAiQueue.enqueue(() =>
      generateBetterExplanation(
        parsed.data.question,
        parsed.data.answer,
      )
    );

    if (!explanation) {
      return NextResponse.json(
        { error: "Could not generate explanation right now." },
        { status: 502 },
      );
    }

    return NextResponse.json({ explanation }, { headers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
