import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { canMutateTasks, requireUser } from "@/lib/team/user-auth";
import { logActivity } from "@/lib/team/activity";
import type { Priority, Project, Status, Task } from "@/lib/team/types";

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

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const assignee = url.searchParams.get("assignee");
  const priority = url.searchParams.get("priority");

  let q = teamDb
    .from("tt_tasks")
    .select("*")
    .eq("project_id", project.id)
    .is("deleted_at", null);
  if (status) q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (assignee) q = q.eq("assignee_id", Number(assignee));

  const { data, error } = await q.order("position", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data, project });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  if (!canMutateTasks(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const project = await getProject(Number(id), user.organization_id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const status: Status = ["todo", "in_progress", "done"].includes(body.status)
    ? body.status
    : "todo";
  const priority: Priority = ["low", "medium", "high"].includes(body.priority)
    ? body.priority
    : "medium";

  // Compute next number in project
  const { data: latest } = await teamDb
    .from("tt_tasks")
    .select("number")
    .eq("project_id", project.id)
    .order("number", { ascending: false })
    .limit(1);
  const nextNumber = (((latest as { number: number }[] | null) ?? [])[0]?.number ?? 0) + 1;

  // Compute next position in the target status column
  const { data: posRows } = await teamDb
    .from("tt_tasks")
    .select("position")
    .eq("project_id", project.id)
    .eq("status", status)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition =
    (((posRows as { position: number }[] | null) ?? [])[0]?.position ?? -1) + 1;

  const assigneeId = body.assignee_id ? Number(body.assignee_id) : user.id;

  const { data: task, error } = await teamDb
    .from("tt_tasks")
    .insert({
      project_id: project.id,
      number: nextNumber,
      title,
      description: body.description || null,
      status,
      priority,
      assignee_id: assigneeId,
      creator_id: user.id,
      due_date: body.due_date || null,
      position: nextPosition,
    })
    .select()
    .single();
  if (error || !task) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }

  const t = task as Task;
  await logActivity(t.id, user.id, "created", { status: t.status });
  return NextResponse.json({ task });
}
