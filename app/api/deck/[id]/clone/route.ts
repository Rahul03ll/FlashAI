import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    let userId: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.userId === "string") {
        userId = body.userId;
      }
    } catch {
      // no body
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID is required to clone deck." }, { status: 400 });
    }

    const sourceDeck = await prisma.deck.findUnique({
      where: { id },
      include: { cards: true },
    });

    if (!sourceDeck) {
      return NextResponse.json({ error: "Source deck not found." }, { status: 404 });
    }

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: `Learner-${userId.slice(-4).toUpperCase()}`,
      },
    });

    // Create personal clone for this user with fresh spaced repetition state
    const cloned = await prisma.deck.create({
      data: {
        title: `${sourceDeck.title} (My Copy)`,
        sourceFileName: sourceDeck.sourceFileName,
        userId,
        isPublic: false,
        cards: {
          create: sourceDeck.cards.map((c) => ({
            question: c.question,
            answer: c.answer,
            type: c.type,
            ease: 2.5,
            interval: 1,
            repetitions: 0,
            difficultyScore: 0,
            dueDate: new Date(),
          })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      deckId: cloned.id,
      title: cloned.title,
      cardCount: sourceDeck.cards.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clone deck.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
