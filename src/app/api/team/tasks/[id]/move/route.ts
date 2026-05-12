import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { canMutateTasks, requireUser } from "@/lib/team/user-auth";
import { describeDbError } from "@/lib/team/db-error";
import { logActivity } from "@/lib/team/activity";
import type { Status, Task } from "@/lib/team/types";

/**
 * Move a task to a new status and/or position. Optionally also reassign
 * sprint_id — used by the board's Backlog column, where dropping a task
 * clears its sprint, and dragging out assigns it to the current sprint.
 *
 * Body: { status: Status, position: number, sprint_id?: number | null }
 * Position is 0-indexed within the destination column.
 *
 * If `sprint_id` is omitted, the task's existing sprint is preserved.
 * If present, it must reference a sprint in the same project (or be null).
 */
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
  const body = await req.json();
  const newStatus = body.status as Status;
  const newPosition = Number(body.position);
  if (
    !["todo", "in_progress", "in_review", "in_uat", "done"].includes(newStatus) ||
    Number.isNaN(newPosition)
  ) {
    return NextResponse.json({ error: "Invalid status or position" }, { status: 400 });
  }

  const { data: rows } = await teamDb
    .from("tt_tasks")
    .select("*, tt_projects!inner(organization_id)")
    .eq("id", Number(id))
    .is("deleted_at", null)
    .maybeSingle();
  const task = rows as (Task & { tt_projects: { organization_id: number } }) | null;
  if (!task || task.tt_projects.organization_id !== user.organization_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const oldStatus = task.status;
  const oldSprintId = task.sprint_id;
  const projectId = task.project_id;

  // Optional sprint reassignment. `undefined` = no change; `null` = backlog;
  // number = move into that sprint (must belong to the same project).
  let newSprintId: number | null | undefined = undefined;
  if ("sprint_id" in body) {
    const raw = body.sprint_id;
    if (raw === null) {
      newSprintId = null;
    } else if (typeof raw === "number" || (typeof raw === "string" && raw !== "")) {
      const candidate = Number(raw);
      if (!Number.isFinite(candidate)) {
        return NextResponse.json({ error: "Invalid sprint_id" }, { status: 400 });
      }
      const { data: target } = await teamDb
        .from("tt_sprints")
        .select("id, project_id")
        .eq("id", candidate)
        .maybeSingle();
      const t = target as { id: number; project_id: number } | null;
      if (!t || t.project_id !== projectId) {
        return NextResponse.json(
          { error: "Sprint does not belong to this project" },
          { status: 400 },
        );
      }
      newSprintId = candidate;
    }
  }

  // Fetch every non-deleted task in the project, grouped by column, ordered by position.
  const { data: allRaw, error: allErr } = await teamDb
    .from("tt_tasks")
    .select("id,status,position")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (allErr) return NextResponse.json({ error: describeDbError(allErr) }, { status: 500 });
  const all = (allRaw || []) as Array<Pick<Task, "id" | "status" | "position">>;

  type Col = Status;
  const byCol: Record<Col, Array<Pick<Task, "id" | "status" | "position">>> = {
    todo: [],
    in_progress: [],
    in_review: [],
    in_uat: [],
    done: [],
  };
  for (const t of all) byCol[t.status as Col].push(t);
  (Object.keys(byCol) as Col[]).forEach((k) =>
    byCol[k].sort((a, b) => a.position - b.position),
  );

  // Remove task from its old column
  byCol[oldStatus] = byCol[oldStatus].filter((t) => t.id !== task.id);
  // Insert into new column at requested position (clamped)
  const clamped = Math.max(0, Math.min(newPosition, byCol[newStatus].length));
  byCol[newStatus].splice(clamped, 0, { id: task.id, status: newStatus, position: clamped });

  // Recompute positions for the two affected columns (or one if same)
  const affected: Col[] = oldStatus === newStatus ? [newStatus] : [oldStatus, newStatus];
  const updates: Array<{ id: number; status: Col; position: number }> = [];
  for (const col of affected) {
    byCol[col].forEach((t, i) => {
      updates.push({ id: t.id, status: col, position: i });
    });
  }

  // Apply updates. Individual failures abort the sequence with a 500 so the
  // client gets a clear error (previously we swallowed them silently).
  for (const u of updates) {
    const patch: Record<string, unknown> = {
      status: u.status,
      position: u.position,
      updated_at: new Date().toISOString(),
    };
    // Only the task being moved gets its sprint reassigned, not the others
    // whose positions were merely recomputed.
    if (u.id === task.id && newSprintId !== undefined) {
      patch.sprint_id = newSprintId;
    }
    const { error: upErr } = await teamDb
      .from("tt_tasks")
      .update(patch)
      .eq("id", u.id);
    if (upErr) {
      return NextResponse.json({ error: describeDbError(upErr) }, { status: 500 });
    }
  }

  if (oldStatus !== newStatus) {
    await logActivity(task.id, user.id, "status_changed", {
      from: oldStatus,
      to: newStatus,
    });
  }

  if (newSprintId !== undefined && newSprintId !== oldSprintId) {
    await logActivity(task.id, user.id, "sprint_changed", {
      from: oldSprintId,
      to: newSprintId,
    });
  }

  const { data: fresh, error: freshErr } = await teamDb
    .from("tt_tasks")
    .select("*")
    .eq("id", task.id)
    .single();
  if (freshErr) return NextResponse.json({ error: describeDbError(freshErr) }, { status: 500 });
  return NextResponse.json({ task: fresh });
}
