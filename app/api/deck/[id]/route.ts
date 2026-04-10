import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const deck = await prisma.deck.findUnique({
      where: { id },
      include: {
        cards: {
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!deck) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    return NextResponse.json({ deck });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const deck = await prisma.deck.findUnique({ where: { id }, select: { id: true } });
    if (!deck) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    await prisma.deck.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
