import { streamFlashcardsFromText } from "@/lib/groq";
import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/pdf";
import { generatedFlashcardSchema, generatedFlashcardsSchema } from "@/types/flashcard";

export const runtime = "nodejs";

// Simple in-memory rate limiter: 5 req/min per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

type StreamEvent =
  | { type: "card"; card: { question: string; answer: string; type: string } }
  | { type: "done"; deckId: string; cardsCount: number; truncated: boolean }
  | { type: "error"; error: string };

function encodeEvent(encoder: TextEncoder, event: StreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "AI service is not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // IP rate limiting
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const now = Date.now();
    let ipData = rateLimitMap.get(clientIp) || { count: 0, resetTime: now };
    if (now - ipData.resetTime > 60000) {
      ipData = { count: 0, resetTime: now };
    }
    if (ipData.count >= 5) {
      return new Response(JSON.stringify({ error: "Too many requests, please wait a minute" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
    ipData.count += 1;
    rateLimitMap.set(clientIp, ipData);

    const formData = await request.formData();
    const maybeFile = formData.get("file");
    const deckTitleInput = formData.get("title");

    if (!(maybeFile instanceof File)) {
      return new Response(
        JSON.stringify({ type: "error", error: "No PDF file uploaded." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (maybeFile.type !== "application/pdf") {
      return new Response(JSON.stringify({ type: "error", error: "Uploaded file must be a PDF." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (maybeFile.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ type: "error", error: "PDF is too large. Maximum size is 10 MB." }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    const text = await extractPdfText(maybeFile);
    if (!text) {
      return new Response(
        JSON.stringify({ type: "error", error: "Could not extract text from the uploaded PDF." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const title =
      typeof deckTitleInput === "string" && deckTitleInput.trim()
        ? deckTitleInput.trim()
        : `FlashAI Deck ${new Date().toLocaleDateString()}`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const truncatedText = text.slice(0, 12000);
          const completion = await streamFlashcardsFromText(truncatedText);
          const cards: Array<{ question: string; answer: string; type: string }> = [];
          let buffer = "";

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (!delta) continue;
            buffer += delta;

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;

              try {
                const parsed: unknown = JSON.parse(line);
                const validated = generatedFlashcardSchema.safeParse(parsed);
                if (!validated.success) continue;

                const isDuplicate = cards.some(
                  (card) =>
                    card.question.toLowerCase() === validated.data.question.toLowerCase() &&
                    card.answer.toLowerCase() === validated.data.answer.toLowerCase(),
                );
                if (isDuplicate) continue;

                cards.push(validated.data);
                controller.enqueue(
                  encodeEvent(encoder, { type: "card", card: validated.data }),
                );
              } catch {
                // skip malformed partial lines
              }
            }
          }

          const tail = buffer.trim();
          if (tail) {
            try {
              const parsed: unknown = JSON.parse(tail);
              const validated = generatedFlashcardSchema.safeParse(parsed);
              if (validated.success) {
                cards.push(validated.data);
                controller.enqueue(encodeEvent(encoder, { type: "card", card: validated.data }));
              }
            } catch {
              // ignore non-JSON tail
            }
          }

          const parsedFlashcards = generatedFlashcardsSchema.safeParse(cards);
          if (!parsedFlashcards.success || parsedFlashcards.data.length === 0) {
            controller.enqueue(
              encodeEvent(encoder, {
                type: "error",
                error: "AI returned invalid flashcard JSON format.",
              }),
            );
            controller.close();
            return;
          }

          const limitedCards = parsedFlashcards.data.slice(0, 20);

          const deck = await prisma.deck.create({
            data: {
              title,
              sourceFileName: maybeFile.name,
              cards: {
                create: limitedCards.map((card) => ({
                  question: card.question,
                  answer: card.answer,
                  type: card.type,
                })),
              },
            },
          });

          controller.enqueue(
            encodeEvent(encoder, {
              type: "done",
              deckId: deck.id,
              cardsCount: limitedCards.length,
              truncated: text.length >= 12000,
            }),
          );
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unexpected server error occurred.";
          controller.enqueue(encodeEvent(encoder, { type: "error", error: message }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error occurred.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
