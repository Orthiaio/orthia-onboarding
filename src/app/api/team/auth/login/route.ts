import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { setSessionCookie, verifyPassword } from "@/lib/team/user-auth";
import { rateLimit } from "@/lib/rate-limit";
import type { User } from "@/lib/team/types";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const { allowed } = rateLimit(`team-login:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const { data, error } = await teamDb
    .from("tt_users")
    .select("*")
    .eq("email", String(email).toLowerCase().trim())
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const user = data as User;
  if (!verifyPassword(String(password), user.password_hash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  setSessionCookie(res, user.id);
  return res;
}
