import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";
import type { Sprint } from "@/lib/team/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(req, { roles: ["admin", "developer"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

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
  if (sprint.state !== "planned") {
    return NextResponse.json(
      { error: `Can't start a ${sprint.state} sprint` },
      { status: 400 },
    );
  }

  // Ensure no other active sprint in the project.
  const { count } = await teamDb
    .from("tt_sprints")
    .select("*", { count: "exact", head: true })
    .eq("project_id", sprint.project_id)
    .eq("state", "active");
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Another sprint is already active in this project" },
      { status: 409 },
    );
  }

  const { data, error } = await teamDb
    .from("tt_sprints")
    .update({
      state: "active",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sprint.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sprint: data });
}
