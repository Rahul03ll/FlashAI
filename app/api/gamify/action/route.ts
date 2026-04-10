import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ACTION_POINTS, getLevel, getTodayKey, getYesterdayKey } from "@/lib/gamification";

const schema = z.object({
  userId: z.string().min(1),
  action: z.enum(["easy", "good", "hard", "quiz-correct"]),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const pointsToAdd = ACTION_POINTS[parsed.data.action];
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const today = getTodayKey();
    const yesterday = getYesterdayKey();

    let nextStreak = user.streak;
    if (user.lastActiveDay === today) {
      nextStreak = user.streak;
    } else if (user.lastActiveDay === yesterday) {
      nextStreak = user.streak + 1;
    } else {
      nextStreak = 1;
    }

    const previousLevel = getLevel(user.points);
    // Compute optimistic next values for level-up/milestone checks.
    const nextPoints = user.points + pointsToAdd;
    const nextLevel = getLevel(nextPoints);

    // Use atomic increments so concurrent requests cannot overwrite each other's
    // points/xp (SQL: SET points = points + N, not SET points = <snapshot>).
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        points: { increment: pointsToAdd },
        xp: { increment: pointsToAdd },
        streak: nextStreak,
        lastActiveDay: today,
        lastStudiedDate: new Date(),
      },
    });

    const milestone = Math.floor(user.points / 100) < Math.floor(updated.points / 100);

    return NextResponse.json({
      user: {
        id: updated.id,
        points: updated.points,
        xp: updated.xp,
        streak: updated.streak,
        level: nextLevel,
      },
      gained: pointsToAdd,
      levelUp: previousLevel !== nextLevel,
      milestone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
