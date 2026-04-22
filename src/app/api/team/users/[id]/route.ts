import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { hashPassword, requireUser } from "@/lib/team/user-auth";
import type { Role } from "@/lib/team/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req, { roles: ["admin"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const targetId = Number(id);

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if ((["admin", "developer", "viewer"] as Role[]).includes(body.role)) {
    patch.role = body.role;
  }
  if (typeof body.password === "string" && body.password.length >= 8) {
    patch.password_hash = hashPassword(body.password);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await teamDb
    .from("tt_users")
    .update(patch)
    .eq("id", targetId)
    .eq("organization_id", user.organization_id)
    .select("id,name,email,role,organization_id,created_at,updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req, { roles: ["admin"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const targetId = Number(id);
  if (targetId === user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }
  const { error } = await teamDb
    .from("tt_users")
    .delete()
    .eq("id", targetId)
    .eq("organization_id", user.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
