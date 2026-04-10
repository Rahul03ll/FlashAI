import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/gamification";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        displayName: {
          not: null,
        },
      },
      orderBy: [{ xp: "desc" }, { streak: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        displayName: true,
        xp: true,
        streak: true,
      },
    });

    return NextResponse.json({
      users: users.map((user, index) => ({
        id: user.id,
        rank: index + 1,
        displayName: user.displayName!,
        xp: user.xp,
        streak: user.streak,
        level: getLevel(user.xp),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ users: [], warning: message });
  }
}

