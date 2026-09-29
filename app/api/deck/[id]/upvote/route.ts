import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerUserId } from "@/lib/server-user";

type UpvoteRouteProps = {
  params: Promise<{ id: string }>;
};

// In-memory set for tracking (deckId:userId) pairs for toggle behavior
const userUpvotes = new Set<string>();

export async function POST(req: NextRequest, { params }: UpvoteRouteProps) {
  try {
    const { id: deckId } = await params;
    let userId: string | null = null;

    try {
      const body = await req.json();
      if (body && typeof body.userId === "string" && body.userId.trim()) {
        userId = body.userId.trim();
      }
    } catch {
      // payload might be empty
    }

    if (!userId) {
      userId = await getServerUserId();
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required to upvote a deck." },
        { status: 400 }
      );
    }

    // Check if deck exists
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { id: true, upvotes: true },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    const voteKey = `${deckId}:${userId}`;
    const alreadyUpvoted = userUpvotes.has(voteKey);

    let updatedCount = deck.upvotes || 0;

    if (alreadyUpvoted) {
      userUpvotes.delete(voteKey);
      updatedCount = Math.max(0, updatedCount - 1);
    } else {
      userUpvotes.add(voteKey);
      updatedCount += 1;
    }

    try {
      await prisma.deck.update({
        where: { id: deckId },
        data: { upvotes: updatedCount },
      });
    } catch {
      // Offline or mock database fallback
    }

    return NextResponse.json({
      success: true,
      upvoted: !alreadyUpvoted,
      upvoteCount: updatedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
