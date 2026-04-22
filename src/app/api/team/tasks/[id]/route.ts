import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { canMutateTasks, requireUser } from "@/lib/team/user-auth";
import { logActivity } from "@/lib/team/activity";
import type { Priority, Task } from "@/lib/team/types";

async function loadTaskInOrg(taskId: number, orgId: number) {
  const { data } = await teamDb
    .from("tt_tasks")
    .select("*, tt_projects!inner(organization_id,id,key)")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const t = data as Task & { tt_projects: { organization_id: number; id: number; key: string } };
  if (t.tt_projects.organization_id !== orgId) return null;
  return t;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const task = await loadTaskInOrg(Number(id), user.organization_id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [commentsRes, activitiesRes, usersRes] = await Promise.all([
    teamDb
      .from("tt_comments")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true }),
    teamDb
      .from("tt_activities")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true }),
    teamDb.from("tt_users").select("id,name,email,role").eq("organization_id", user.organization_id),
  ]);
  return NextResponse.json({
    task,
    project: task.tt_projects,
    comments: commentsRes.data || [],
    activities: activitiesRes.data || [],
    users: usersRes.data || [],
  });
}

export async function PATCH(
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
  const task = await loadTaskInOrg(Number(id), user.organization_id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim() && body.title !== task.title) {
    patch.title = body.title.trim();
    await logActivity(task.id, user.id, "title_changed", { from: task.title, to: body.title.trim() });
  }
  if (typeof body.description === "string" && body.description !== (task.description ?? "")) {
    patch.description = body.description;
    await logActivity(task.id, user.id, "description_changed", {});
  }
  if (
    typeof body.priority === "string" &&
    ["low", "medium", "high"].includes(body.priority) &&
    body.priority !== task.priority
  ) {
    patch.priority = body.priority as Priority;
    await logActivity(task.id, user.id, "priority_changed", {
      from: task.priority,
      to: body.priority,
    });
  }
  if ("assignee_id" in body) {
    const newAssignee = body.assignee_id === null ? null : Number(body.assignee_id);
    if (newAssignee !== task.assignee_id) {
      patch.assignee_id = newAssignee;
      if (newAssignee === null) {
        await logActivity(task.id, user.id, "unassigned", { from: task.assignee_id });
      } else {
        await logActivity(task.id, user.id, "assigned", {
          from: task.assignee_id,
          to: newAssignee,
        });
      }
    }
  }
  if ("due_date" in body) {
    const newDue = body.due_date || null;
    if (newDue !== task.due_date) {
      patch.due_date = newDue;
      await logActivity(task.id, user.id, "due_date_changed", {
        from: task.due_date,
        to: newDue,
      });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ task });
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await teamDb
    .from("tt_tasks")
    .update(patch)
    .eq("id", task.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(
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
  const task = await loadTaskInOrg(Number(id), user.organization_id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await teamDb
    .from("tt_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", task.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
