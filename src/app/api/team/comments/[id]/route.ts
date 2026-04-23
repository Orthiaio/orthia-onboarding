import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";
import type { Comment, Task } from "@/lib/team/types";

async function loadComment(id: number, orgId: number) {
  const { data } = await teamDb
    .from("tt_comments")
    .select("*, tt_tasks!inner(project_id, tt_projects!inner(organization_id))")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const c = data as Comment & {
    tt_tasks: { project_id: number; tt_projects: { organization_id: number } };
  };
  if (c.tt_tasks.tt_projects.organization_id !== orgId) return null;
  return c;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const c = await loadComment(Number(id), user.organization_id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.author_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { body } = await req.json();
  const text = String(body || "").trim();
  if (!text) return NextResponse.json({ error: "Empty" }, { status: 400 });
  if (text.length > 10_000) {
    return NextResponse.json(
      { error: "Comment is too long (10,000 character max)" },
      { status: 400 },
    );
  }
  const { data, error } = await teamDb
    .from("tt_comments")
    .update({ body: text, updated_at: new Date().toISOString() })
    .eq("id", c.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const c = await loadComment(Number(id), user.organization_id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.author_id !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await teamDb.from("tt_comments").delete().eq("id", c.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
