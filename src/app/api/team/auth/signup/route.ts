import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { hashPassword, setSessionCookie } from "@/lib/team/user-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * First-time setup. Creates the organization and the first admin user.
 * Disabled once any organization exists — further users must be invited by an admin.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const { allowed } = rateLimit(`team-signup:${ip}`, { maxRequests: 5, windowMs: 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const { orgName, name, email, password } = await req.json();
  if (!orgName || !name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const { count, error: countErr } = await teamDb
    .from("tt_organizations")
    .select("*", { count: "exact", head: true });
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Setup already complete. Ask an admin to invite you." },
      { status: 403 },
    );
  }

  const slug = String(orgName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "org";

  const { data: org, error: orgErr } = await teamDb
    .from("tt_organizations")
    .insert({ name: orgName, slug })
    .select()
    .single();
  if (orgErr || !org) {
    return NextResponse.json({ error: orgErr?.message || "Could not create org" }, { status: 500 });
  }

  const { data: user, error: userErr } = await teamDb
    .from("tt_users")
    .insert({
      organization_id: org.id,
      name,
      email: String(email).toLowerCase().trim(),
      password_hash: hashPassword(password),
      role: "admin",
    })
    .select()
    .single();
  if (userErr || !user) {
    return NextResponse.json({ error: userErr?.message || "Could not create user" }, { status: 500 });
  }

  const res = NextResponse.json({ success: true, userId: user.id });
  setSessionCookie(res, user.id);
  return res;
}
