import { NextRequest, NextResponse } from "next/server";
import { safeCompare, setGateCookieOn, TEAM_GATE_PASSWORD } from "@/lib/team/gate-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const { allowed } = rateLimit(`team-gate:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  const { password } = await req.json();
  if (!safeCompare(String(password ?? ""), TEAM_GATE_PASSWORD)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  await setGateCookieOn(res);
  return res;
}
