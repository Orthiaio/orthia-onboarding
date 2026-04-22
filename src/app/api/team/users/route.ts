import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { hashPassword, requireUser } from "@/lib/team/user-auth";
import type { Role } from "@/lib/team/types";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { data, error } = await teamDb
    .from("tt_users")
    .select("id,name,email,role,organization_id,created_at,updated_at")
    .eq("organization_id", user.organization_id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { roles: ["admin"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const body = await req.json();
  const email = String(body.email || "").toLowerCase().trim();
  const name = String(body.name || "").trim();
  const role = (["admin", "developer", "viewer"] as Role[]).includes(body.role)
    ? (body.role as Role)
    : "developer";
  const password = String(body.password || "");
  if (!email || !name) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Initial password must be at least 8 characters" },
      { status: 400 },
    );
  }
  const { data, error } = await teamDb
    .from("tt_users")
    .insert({
      organization_id: user.organization_id,
      name,
      email,
      password_hash: hashPassword(password),
      role,
    })
    .select("id,name,email,role,organization_id,created_at,updated_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ user: data });
}
