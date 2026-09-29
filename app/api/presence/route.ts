import { NextRequest, NextResponse } from "next/server";
import { globalPresenceTracker } from "@/lib/presence";
import { getServerUserId } from "@/lib/server-user";

export async function GET() {
  const activeUsers = globalPresenceTracker.getActiveCount();
  return NextResponse.json({ activeUsers });
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.userId === "string" && body.userId.trim()) {
        userId = body.userId.trim();
      }
    } catch {
      // payload might be empty
    }

    if (!userId) {
      userId = await getServerUserId();
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required for presence heartbeat." },
        { status: 400 }
      );
    }

    const result = globalPresenceTracker.recordHeartbeat(userId);
    return NextResponse.json({ activeUsers: result.activeUsers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
