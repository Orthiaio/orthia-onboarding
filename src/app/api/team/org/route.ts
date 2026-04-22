import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req, { roles: ["admin"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { name } = await req.json();
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const { data, error } = await teamDb
    .from("tt_organizations")
    .update({ name: String(name).trim(), updated_at: new Date().toISOString() })
    .eq("id", user.organization_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ org: data });
}
