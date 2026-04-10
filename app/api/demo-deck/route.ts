import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const sampleCards = [
  {
    question: "What is spaced repetition?",
    answer: "A study technique that schedules reviews at increasing intervals — so you revisit material just before you'd forget it, locking it into long-term memory.",
    type: "definition",
  },
  {
    question: "What is the SM-2 algorithm?",
    answer: "An algorithm that computes the next review interval based on your recall quality (ease factor). Correct answers grow the interval; incorrect answers reset it to 1 day.",
    type: "definition",
  },
  {
    question: "Why does active recall outperform rereading?",
    answer: "Retrieving a memory strengthens the neural pathway more than passively seeing it. Each successful recall also reveals which knowledge is fragile vs. solid.",
    type: "reasoning",
  },
  {
    question: "Why do longer review intervals lead to better retention?",
    answer: "Each retrieval attempt during a longer interval requires more mental effort, which signals the brain to consolidate that memory more deeply — the 'desirable difficulty' effect.",
    type: "reasoning",
  },
  {
    question: "Misconception: Does feeling like you understand mean you'll remember it?",
    answer: "No. Familiarity (recognition) and recall (retrieval) are different. You can recognise a concept while being unable to reproduce it under test conditions.",
    type: "misconception",
  },
  {
    question: "Misconception: Is it better to study the same topic for hours in one go?",
    answer: "No. Massed practice creates an illusion of mastery. Interleaving topics and spreading sessions over days produces far stronger long-term retention.",
    type: "misconception",
  },
  {
    question: "Worked example: You rate a card 'Hard' three times in a row. What should you do?",
    answer: "Split the card into two simpler sub-cards, rewrite the question to be more concrete, and add a memory hook (analogy, mnemonic, or image) to the answer.",
    type: "example",
  },
  {
    question: "Worked example: How do you turn a textbook paragraph into flashcards?",
    answer: "Identify one atomic concept per card. Write the question in your own words. Check that the answer can be recalled without re-reading the question a second time.",
    type: "example",
  },
  {
    question: "Edge case: What if you have 200 due cards and limited study time?",
    answer: "Prioritise cards with the lowest ease factor first. Skip cards already well above interval thresholds — missing one review by a day rarely causes significant forgetting.",
    type: "edge",
  },
  {
    question: "Edge case: How do you handle cards about evolving topics (e.g., software versions)?",
    answer: "Tag them with a version number and set a calendar reminder to audit the deck each release cycle. Suspend outdated cards rather than deleting — historical context can still be useful.",
    type: "edge",
  },
];

export async function POST() {
  try {
    const deck = await prisma.deck.create({
      data: {
        title: "FlashAI Demo Deck",
        sourceFileName: "Demo",
        cards: {
          create: sampleCards,
        },
      },
    });

    return NextResponse.json({ deckId: deck.id, sourceFileName: deck.sourceFileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create demo deck.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
