import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const isPublic = Boolean(body.isPublic);

    const updated = await prisma.deck.update({
      where: { id },
      data: { isPublic },
      select: { id: true, isPublic: true, title: true },
    });

    return NextResponse.json({ success: true, deck: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update deck privacy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
