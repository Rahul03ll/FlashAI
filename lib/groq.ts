import Groq from "groq-sdk";
import type { ChatCompletionChunk } from "groq-sdk/resources/chat/completions.mjs";

/** Single source of truth for the model used across all Groq calls. */
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const FALLBACK_MODELS = [
  GROQ_MODEL,
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

// Module-level singleton — reuses the same TCP connection across requests.
let _groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (_groqClient) return _groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable.");
  }

  _groqClient = new Groq({ apiKey });
  return _groqClient;
}

/**
 * Executes a chat completion across the prioritized fallback models if
 * the primary model is deprecated or unavailable (e.g. 404 model_not_found).
 */
async function createChatCompletionWithFallback(
  groq: Groq,
  params: Omit<Groq.Chat.CompletionCreateParams, "model"> & { stream: true },
): Promise<AsyncIterable<ChatCompletionChunk>>;
async function createChatCompletionWithFallback(
  groq: Groq,
  params: Omit<Groq.Chat.CompletionCreateParams, "model"> & { stream?: false },
): Promise<Groq.Chat.ChatCompletion>;
async function createChatCompletionWithFallback(
  groq: Groq,
  params: Omit<Groq.Chat.CompletionCreateParams, "model"> & { stream?: boolean },
) {
  let lastError: unknown;

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await groq.chat.completions.create({
        ...params,
        model,
      } as Groq.Chat.CompletionCreateParams);
      return response;
    } catch (err: unknown) {
      lastError = err;
      const isNotFound =
        typeof err === "object" &&
        err !== null &&
        ("status" in err && (err as { status: number }).status === 404 ||
          "code" in err && (err as { code: string }).code === "model_not_found");

      if (isNotFound) {
        console.warn(`[Groq] Model "${model}" unavailable, trying fallback...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export function sanitizeJsonLine(raw: string): string | null {
  let line = raw.trim();
  if (!line) return null;
  if (line.startsWith("```") || line === "```") return null;
  line = line.replace(/^[-*•\d.]+\s+(?=\{)/, "");
  line = line.replace(/\\+$/, "").trim();
  if (line.endsWith(",") || line.endsWith(";")) {
    line = line.slice(0, -1).trim();
  }
  return line;
}

export function buildFlashcardPrompt(text: string): string {
  return `You are an expert study-card author. Generate 15–20 flashcards from the TEXT below.

REQUIRED DISTRIBUTION — you MUST produce AT LEAST:
  • 3 × "definition"    — define a key term or concept precisely
  • 3 × "reasoning"     — explain WHY something happens or HOW it works
  • 3 × "misconception" — name a common wrong belief and correct it
  • 3 × "example"       — walk through a concrete worked example step-by-step
  • 2 × "edge"          — describe an unusual / boundary / failure case

QUALITY RULES:
  - Every question must be answerable from the text alone.
  - Answers ≤ 3 sentences. Clear, exam-quality language.
  - No two cards may share the same question or the same first sentence of their answer.
  - Do NOT include cards about the author, page numbers, or document metadata.

FEW-SHOT EXAMPLES (follow this style exactly):
{"question":"What is spaced repetition?","answer":"A study technique that schedules reviews at increasing intervals—revisiting material just before you would forget it—to transfer information into long-term memory efficiently.","type":"definition"}
{"question":"Why does active recall outperform rereading?","answer":"Retrieving a memory strengthens the neural pathway more than passively re-reading it. Each successful recall also reveals which knowledge is fragile, letting you focus effort where it matters most.","type":"reasoning"}
{"question":"Is rereading the same as studying?","answer":"No. Rereading creates an illusion of familiarity (recognition) without building reliable retrieval ability. Students who only reread consistently score lower on delayed tests than those who practice active recall.","type":"misconception"}
{"question":"Worked example: You rate a card 'Hard' three times in a row. What should you do?","answer":"1) Split the card into two simpler sub-cards. 2) Rewrite the question more concretely. 3) Add a mnemonic or analogy to the answer to reduce cognitive load.","type":"example"}
{"question":"Edge case: What happens to SM-2 scheduling if a user skips reviews for 30 days?","answer":"The algorithm has no concept of 'overdue'. On next review the card is treated as due immediately; the interval is recalculated from the last recorded ease factor, potentially over-scheduling the next review.","type":"edge"}

OUTPUT FORMAT — respond with ONLY JSONL (exactly one JSON object per line, no backslashes, no code fences):
{"question":"...","answer":"...","type":"definition"}

TEXT:
${text}`;
}

export async function streamFlashcardsFromText(text: string) {
  const groq = getGroqClient();

  const completion = await createChatCompletionWithFallback(groq, {
    messages: [
      {
        role: "system",
        content:
          "You are a study assistant that outputs strictly valid JSONL flashcards. Each line must be a single standalone JSON object without markdown code blocks, backslashes, or trailing characters.",
      },
      {
        role: "user",
        content: buildFlashcardPrompt(text),
      },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    stream: true,
  });

  return completion as AsyncIterable<ChatCompletionChunk>;
}

export async function generateDistractors(question: string, correctAnswer: string) {
  const groq = getGroqClient();

  const prompt = `
Given this question and answer:

Question: ${question}
Correct Answer: ${correctAnswer}

Generate 3 incorrect but plausible distractors.
Return JSON:
["option1", "option2", "option3"]

Rules:
- Keep distractors realistic and relevant
- Do not repeat the correct answer
- Keep answer length similar to the correct answer
- Return only JSON
`;

  const completion = await createChatCompletionWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: "You return only valid JSON arrays.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? "";
}

export async function generateBetterExplanation(question: string, answer: string) {
  const groq = getGroqClient();

  const prompt = `
Explain the following concept in a clear, simple, and intuitive way.

Question: ${question}
Answer: ${answer}

Instructions:
- Use simple language
- Give examples if helpful
- Explain WHY, not just WHAT
- Keep it concise but insightful

Return plain text.
`;

  const completion = await createChatCompletionWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: "You are an expert tutor. Reply with plain text only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
