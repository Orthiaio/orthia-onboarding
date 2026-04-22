import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { getCurrentUser } from "@/lib/team/user-auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    // Check if any org exists — if not, signal first-time setup.
    const { count } = await teamDb
      .from("tt_organizations")
      .select("*", { count: "exact", head: true });
    return NextResponse.json({ user: null, needsSetup: (count ?? 0) === 0 });
  }
  const { data: org } = await teamDb
    .from("tt_organizations")
    .select("*")
    .eq("id", user.organization_id)
    .maybeSingle();
  return NextResponse.json({ user, org });
}
