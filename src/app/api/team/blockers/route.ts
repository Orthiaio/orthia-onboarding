import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";
import { describeDbError } from "@/lib/team/db-error";
import type { Task } from "@/lib/team/types";

// List every currently-blocked task across the caller's organization.
// "Resolved" blockers (blocked=false) are excluded by default; pass ?include=all
// to also see tasks that were ever blocked (useful for an audit/history view).
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const url = new URL(req.url);
  const includeAll = url.searchParams.get("include") === "all";

  let q = teamDb
    .from("tt_tasks")
    .select(
      "*, tt_projects!inner(id, key, name, organization_id)",
    )
    .eq("tt_projects.organization_id", user.organization_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (!includeAll) q = q.eq("blocked", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: describeDbError(error) }, { status: 500 });

  const rows = (data || []) as (Task & {
    tt_projects: { id: number; key: string; name: string; organization_id: number };
  })[];
  const blockers = rows.map((r) => ({
    task: {
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status,
      type: r.type,
      priority: r.priority,
      assignee_id: r.assignee_id,
      reporter_id: r.reporter_id,
      creator_id: r.creator_id,
      blocked: r.blocked,
      blocked_reason: r.blocked_reason,
      created_at: r.created_at,
      updated_at: r.updated_at,
    },
    project: {
      id: r.tt_projects.id,
      key: r.tt_projects.key,
      name: r.tt_projects.name,
    },
  }));
  return NextResponse.json({ blockers });
}
