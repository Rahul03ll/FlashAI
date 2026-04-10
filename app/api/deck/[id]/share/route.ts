import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Return the existing token if the deck has already been shared,
    // so repeated calls do not invalidate previously distributed links.
    const existing = await prisma.deck.findUnique({
      where: { id },
      select: { shareToken: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    const token = existing.shareToken ?? randomUUID();

    if (!existing.shareToken) {
      await prisma.deck.update({
        where: { id },
        data: { shareToken: token },
      });
    }

    return NextResponse.json({
      shareUrl: `/share/${token}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate share link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
