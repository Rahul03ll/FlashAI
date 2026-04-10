import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBetterExplanation } from "@/lib/groq";

export const runtime = "nodejs";

const explainSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = explainSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const explanation = await generateBetterExplanation(
      parsed.data.question,
      parsed.data.answer,
    );

    if (!explanation) {
      return NextResponse.json(
        { error: "Could not generate explanation right now." },
        { status: 502 },
      );
    }

    return NextResponse.json({ explanation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
