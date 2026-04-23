import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";
import type { Project } from "@/lib/team/types";

async function getProject(id: number, orgId: number): Promise<Project | null> {
  const { data } = await teamDb
    .from("tt_projects")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as Project) || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const project = await getProject(Number(id), user.organization_id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await teamDb
    .from("tt_sprints")
    .select("*")
    .eq("project_id", project.id)
    .order("position", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sprints: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req, { roles: ["admin", "developer"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const project = await getProject(Number(id), user.organization_id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data: posRows } = await teamDb
    .from("tt_sprints")
    .select("position")
    .eq("project_id", project.id)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition =
    (((posRows as { position: number }[] | null) ?? [])[0]?.position ?? -1) + 1;

  const { data, error } = await teamDb
    .from("tt_sprints")
    .insert({
      project_id: project.id,
      name,
      goal: body.goal || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      position: nextPosition,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sprint: data });
}
