import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/gamification";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { displayName: { not: null } },
          { xp: { gt: 0 } },
          { points: { gt: 0 } },
        ],
      },
      orderBy: [{ xp: "desc" }, { streak: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        displayName: true,
        xp: true,
        streak: true,
      },
    });

    if (users.length === 0) {
      const benchmarkUsers = [
        {
          id: "benchmark-1",
          rank: 1,
          displayName: "Alex StudyPro",
          xp: 1450,
          streak: 12,
          level: "Learner" as const,
        },
        {
          id: "benchmark-2",
          rank: 2,
          displayName: "Sophia MemoryAce",
          xp: 980,
          streak: 8,
          level: "Learner" as const,
        },
        {
          id: "benchmark-3",
          rank: 3,
          displayName: "Dev Recall",
          xp: 620,
          streak: 5,
          level: "Learner" as const,
        },
      ];

      return NextResponse.json({
        users: benchmarkUsers,
        isBenchmark: true,
      });
    }

    return NextResponse.json({
      users: users.map((user, index) => ({
        id: user.id,
        rank: index + 1,
        displayName: user.displayName || user.name || "Learner",
        xp: user.xp,
        streak: user.streak,
        level: getLevel(user.xp),
      })),
      isBenchmark: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ users: [], warning: message });
  }
}
