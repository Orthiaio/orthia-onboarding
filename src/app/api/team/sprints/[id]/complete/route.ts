import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";
import { describeDbError } from "@/lib/team/db-error";
import { logActivity } from "@/lib/team/activity";
import type { Sprint } from "@/lib/team/types";

/**
 * Complete an active sprint. Done tasks stay in the completed sprint; everything
 * else moves either to the backlog (default) or to a target sprint if provided.
 *
 * Body: { moveTo?: number | null }  (target sprint id, or null to send to backlog)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req, { roles: ["admin", "developer"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const moveTo: number | null = body?.moveTo ?? null;

  const { data: raw } = await teamDb
    .from("tt_sprints")
    .select("*, tt_projects!inner(organization_id)")
    .eq("id", Number(id))
    .maybeSingle();
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sprint = raw as Sprint & { tt_projects: { organization_id: number } };
  if (sprint.tt_projects.organization_id !== user.organization_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sprint.state !== "active") {
    return NextResponse.json(
      { error: `Can't complete a ${sprint.state} sprint` },
      { status: 400 },
    );
  }

  // If caller wants to move unfinished tasks to a target sprint, validate it.
  if (moveTo != null) {
    const { data: target } = await teamDb
      .from("tt_sprints")
      .select("id, project_id, state")
      .eq("id", moveTo)
      .maybeSingle();
    const t = target as { id: number; project_id: number; state: string } | null;
    if (!t || t.project_id !== sprint.project_id || t.state === "completed") {
      return NextResponse.json(
        { error: "Invalid target sprint" },
        { status: 400 },
      );
    }
  }

  // Find all non-done tasks in this sprint so we can log per-task activity.
  const { data: toMove, error: listErr } = await teamDb
    .from("tt_tasks")
    .select("id")
    .eq("sprint_id", sprint.id)
    .neq("status", "done")
    .is("deleted_at", null);
  if (listErr) return NextResponse.json({ error: describeDbError(listErr) }, { status: 500 });
  const movedIds = ((toMove ?? []) as { id: number }[]).map((r) => r.id);

  if (movedIds.length > 0) {
    const { error: moveErr } = await teamDb
      .from("tt_tasks")
      .update({ sprint_id: moveTo })
      .in("id", movedIds);
    if (moveErr) return NextResponse.json({ error: describeDbError(moveErr) }, { status: 500 });

    // Emit a sprint_changed activity per affected task.
    await Promise.all(
      movedIds.map((tid) =>
        logActivity(tid, user.id, "sprint_changed", { from: sprint.id, to: moveTo }),
      ),
    );
  }

  const { data, error } = await teamDb
    .from("tt_sprints")
    .update({
      state: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sprint.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
  return NextResponse.json({ sprint: data });
}
