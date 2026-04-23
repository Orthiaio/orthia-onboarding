import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { hashPassword, requireUser } from "@/lib/team/user-auth";
import { describeDbError } from "@/lib/team/db-error";
import type { Role } from "@/lib/team/types";

async function countAdmins(orgId: number): Promise<number> {
  const { count } = await teamDb
    .from("tt_users")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("role", "admin");
  return count ?? 0;
}

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

  // Guard: don't let an admin demote themselves or the last remaining admin.
  if (patch.role && patch.role !== "admin") {
    const { data: target } = await teamDb
      .from("tt_users")
      .select("role")
      .eq("id", targetId)
      .eq("organization_id", user.organization_id)
      .maybeSingle();
    const t = target as { role: Role } | null;
    if (t?.role === "admin") {
      const adminCount = await countAdmins(user.organization_id);
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Can't remove the only admin — promote someone else first" },
          { status: 400 },
        );
      }
    }
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await teamDb
    .from("tt_users")
    .update(patch)
    .eq("id", targetId)
    .eq("organization_id", user.organization_id)
    .select("id,name,email,role,organization_id,created_at,updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
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

  // Last-admin guard — never let an org end up with zero admins.
  const { data: target } = await teamDb
    .from("tt_users")
    .select("role")
    .eq("id", targetId)
    .eq("organization_id", user.organization_id)
    .maybeSingle();
  const t = target as { role: Role } | null;
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (t.role === "admin") {
    const adminCount = await countAdmins(user.organization_id);
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Can't delete the only admin — promote someone else first" },
        { status: 400 },
      );
    }
  }

  const { error } = await teamDb
    .from("tt_users")
    .delete()
    .eq("id", targetId)
    .eq("organization_id", user.organization_id);
  if (error) return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
