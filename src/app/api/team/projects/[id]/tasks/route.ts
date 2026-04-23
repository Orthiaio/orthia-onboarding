import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { canMutateTasks, requireUser } from "@/lib/team/user-auth";
import { describeDbError } from "@/lib/team/db-error";
import { logActivity } from "@/lib/team/activity";
import type { Priority, Project, Status, Task, TaskType } from "@/lib/team/types";

const VALID_STATUS: Status[] = ["todo", "in_progress", "in_review", "done"];
const VALID_PRIORITY: Priority[] = ["low", "medium", "high"];
const VALID_TYPE: TaskType[] = ["task", "bug", "story", "epic", "subtask"];

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
  const sprint = url.searchParams.get("sprint"); // "backlog" → null, number → sprint id, "active" → active sprint, missing → no filter
  const parent = url.searchParams.get("parent");
  const type = url.searchParams.get("type");

  let q = teamDb
    .from("tt_tasks")
    .select("*")
    .eq("project_id", project.id)
    .is("deleted_at", null);
  if (status) q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (type) q = q.eq("type", type);
  if (assignee === "null") q = q.is("assignee_id", null);
  else if (assignee) q = q.eq("assignee_id", Number(assignee));
  if (parent === "null") q = q.is("parent_id", null);
  else if (parent) q = q.eq("parent_id", Number(parent));

  if (sprint === "backlog") {
    q = q.is("sprint_id", null);
  } else if (sprint === "active") {
    const { data: active } = await teamDb
      .from("tt_sprints")
      .select("id")
      .eq("project_id", project.id)
      .eq("state", "active")
      .maybeSingle();
    const a = active as { id: number } | null;
    q = a ? q.eq("sprint_id", a.id) : q.is("sprint_id", null);
  } else if (sprint) {
    q = q.eq("sprint_id", Number(sprint));
  }

  const { data, error } = await q.order("position", { ascending: true });
  if (error) return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
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

  const status: Status = VALID_STATUS.includes(body.status) ? body.status : "todo";
  const priority: Priority = VALID_PRIORITY.includes(body.priority) ? body.priority : "medium";
  const type: TaskType = VALID_TYPE.includes(body.type) ? body.type : "task";

  // Next per-project task number
  const { data: latest } = await teamDb
    .from("tt_tasks")
    .select("number")
    .eq("project_id", project.id)
    .order("number", { ascending: false })
    .limit(1);
  const nextNumber = (((latest as { number: number }[] | null) ?? [])[0]?.number ?? 0) + 1;

  // Next position in the target column
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

  const assigneeId = body.assignee_id === null ? null : body.assignee_id ? Number(body.assignee_id) : user.id;
  const reporterId = body.reporter_id === null ? null : body.reporter_id ? Number(body.reporter_id) : user.id;
  const sprintId = body.sprint_id ? Number(body.sprint_id) : null;
  const parentId = body.parent_id ? Number(body.parent_id) : null;
  const storyPoints =
    typeof body.story_points === "number" && Number.isFinite(body.story_points)
      ? Math.max(0, Math.floor(body.story_points))
      : null;
  const labels = Array.isArray(body.labels)
    ? body.labels
        .map((l: unknown) => String(l).trim())
        .filter((l: string) => l.length > 0)
        .slice(0, 20)
    : [];

  const { data: task, error } = await teamDb
    .from("tt_tasks")
    .insert({
      project_id: project.id,
      number: nextNumber,
      title,
      description: body.description || null,
      status,
      priority,
      type,
      assignee_id: assigneeId,
      reporter_id: reporterId,
      creator_id: user.id,
      due_date: body.due_date || null,
      start_date: body.start_date || null,
      position: nextPosition,
      sprint_id: sprintId,
      parent_id: parentId,
      story_points: storyPoints,
      labels,
    })
    .select()
    .single();
  if (error || !task) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }

  const t = task as Task;
  await logActivity(t.id, user.id, "created", { status: t.status, type: t.type });
  return NextResponse.json({ task });
}
