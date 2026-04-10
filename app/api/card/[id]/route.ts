import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateCardSchema = z.object({
  ease: z.number().min(1.3),
  interval: z.number().int().min(1),
  repetitions: z.number().int().min(0),
  difficultyScore: z.number().int().min(0),
  dueDate: z.string(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body: unknown = await request.json();
  const parsed = updateCardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const updated = await prisma.flashcard.update({
      where: { id },
      data: {
        ease: parsed.data.ease,
        interval: parsed.data.interval,
        repetitions: parsed.data.repetitions,
        difficultyScore: parsed.data.difficultyScore,
        dueDate: new Date(parsed.data.dueDate),
        deck: {
          update: {
            lastStudied: new Date(),
          },
        },
      },
    });

    return NextResponse.json({ card: updated });
  } catch (error) {
    // P2025 = "Record to update not found."
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
