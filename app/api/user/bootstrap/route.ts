import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/gamification";

const schema = z.object({
  userId: z.string().min(1),
});

function buildName(userId: string) {
  return `Learner-${userId.slice(-4).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { id: parsed.data.userId },
      update: {},
      create: {
        id: parsed.data.userId,
        name: buildName(parsed.data.userId),
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        points: user.points,
        xp: user.xp,
        streak: user.streak,
        displayName: user.displayName,
        level: getLevel(user.points),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
