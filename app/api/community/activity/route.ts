import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [recentDecks, activeLearners] = await Promise.all([
      prisma.deck.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          createdAt: true,
          user: {
            select: { displayName: true, name: true },
          },
          _count: {
            select: { cards: true },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          OR: [{ xp: { gt: 0 } }, { displayName: { not: null } }],
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          displayName: true,
          name: true,
          xp: true,
          streak: true,
          updatedAt: true,
        },
      }),
    ]);

    const events = [];

    for (const d of recentDecks) {
      const author = d.user?.displayName || d.user?.name || "Community Learner";
      events.push({
        id: `deck-${d.id}`,
        type: "deck",
        text: `📚 ${author} shared a public deck: "${d.title}" (${d._count.cards} cards)`,
        timestamp: d.createdAt,
      });
    }

    for (const u of activeLearners) {
      const name = u.displayName || u.name || "Learner";
      if (u.streak > 1) {
        events.push({
          id: `streak-${u.id}`,
          type: "streak",
          text: `🔥 ${name} is on a ${u.streak}-day review streak!`,
          timestamp: u.updatedAt,
        });
      } else if (u.xp > 0) {
        events.push({
          id: `xp-${u.id}`,
          type: "xp",
          text: `⚡ ${name} earned ${u.xp} XP studying flashcards!`,
          timestamp: u.updatedAt,
        });
      }
    }

    // Sort by most recent
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // If completely empty, supply motivating community benchmark activity
    if (events.length === 0) {
      events.push(
        { id: "e1", type: "welcome", text: "🚀 Welcome to FlashAI Community! Create or clone a deck to begin.", timestamp: new Date() },
        { id: "e2", type: "tip", text: "💡 Active recall strengthens memory retrieval far more than passive rereading.", timestamp: new Date() },
        { id: "e3", type: "streak", text: "🔥 Consistent 5-minute daily reviews beat 3-hour cram sessions!", timestamp: new Date() },
      );
    }

    return NextResponse.json({
      events: events.slice(0, 8),
      liveCount: Math.max(activeLearners.length, 1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ events: [], error: message });
  }
}
