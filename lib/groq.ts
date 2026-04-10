import Groq from "groq-sdk";
import type { ChatCompletionChunk } from "groq-sdk/resources/chat/completions.mjs";

/** Single source of truth for the model used across all Groq calls. */
const GROQ_MODEL = "llama-3.3-70b-versatile";

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

OUTPUT FORMAT — respond with ONLY JSONL (one JSON object per line, no fences, no commentary):
{"question":"...","answer":"...","type":"definition|reasoning|misconception|example|edge"}

TEXT:
${text}`;
}

export async function streamFlashcardsFromText(text: string) {
  const groq = getGroqClient();

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a study assistant that outputs strictly valid JSONL flashcards.",
      },
      {
        role: "user",
        content: buildFlashcardPrompt(text),
      },
    ],
    temperature: 0.5,
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

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
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

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
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
