import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getLevel } from "@/lib/gamification";
import { NextResponse } from "next/server";

const joinSchema = z.object({
  userId: z.string().min(1),
  displayName: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-zA-Z0-9\s]+$/, "Alphanumeric + spaces only"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = joinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { userId, displayName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { displayName },
      select: { id: true, displayName: true, xp: true, streak: true },
    });

    return NextResponse.json({
      success: true,
      user: { ...user, level: getLevel(user.xp) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
