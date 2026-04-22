import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { data: projects } = await teamDb
    .from("tt_projects")
    .select("id,key,name")
    .eq("organization_id", user.organization_id)
    .is("deleted_at", null);
  const projectIds = (projects || []).map((p: { id: number }) => p.id);

  const myOpen = projectIds.length
    ? await teamDb
        .from("tt_tasks")
        .select("*")
        .in("project_id", projectIds)
        .eq("assignee_id", user.id)
        .is("deleted_at", null)
        .neq("status", "done")
        .order("updated_at", { ascending: false })
    : { data: [] };

  const recent = projectIds.length
    ? await teamDb
        .from("tt_tasks")
        .select("*")
        .in("project_id", projectIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(8)
    : { data: [] };

  return NextResponse.json({
    projects: projects || [],
    myTasks: myOpen.data || [],
    recent: recent.data || [],
  });
}
