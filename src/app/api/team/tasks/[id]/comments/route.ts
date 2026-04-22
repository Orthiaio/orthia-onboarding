import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { canMutateTasks, requireUser } from "@/lib/team/user-auth";
import { logActivity } from "@/lib/team/activity";
import type { Comment, Task } from "@/lib/team/types";

async function loadTaskInOrg(taskId: number, orgId: number) {
  const { data } = await teamDb
    .from("tt_tasks")
    .select("*, tt_projects!inner(organization_id)")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const t = data as Task & { tt_projects: { organization_id: number } };
  if (t.tt_projects.organization_id !== orgId) return null;
  return t;
}

// Parse @mentions like @alice or @"Alice Johnson" from the body.
// Resolve them against the org's user list (case-insensitive, first-word-of-name or exact).
function extractMentions(body: string): string[] {
  const out = new Set<string>();
  const re = /@"([^"]+)"|@([A-Za-z0-9_.-]+)/g;
  let m;
  while ((m = re.exec(body))) {
    const token = (m[1] || m[2] || "").trim();
    if (token) out.add(token.toLowerCase());
  }
  return Array.from(out);
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
  const task = await loadTaskInOrg(Number(id), user.organization_id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { body } = await req.json();
  const text = String(body || "").trim();
  if (!text) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });

  const { data: comment, error } = await teamDb
    .from("tt_comments")
    .insert({ task_id: task.id, author_id: user.id, body: text })
    .select()
    .single();
  if (error || !comment) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
  const c = comment as Comment;

  await logActivity(task.id, user.id, "commented", { comment_id: c.id });

  // Mentions
  const tokens = extractMentions(text);
  if (tokens.length > 0) {
    const { data: orgUsers } = await teamDb
      .from("tt_users")
      .select("id,name,email")
      .eq("organization_id", user.organization_id);
    const users = (orgUsers || []) as { id: number; name: string; email: string }[];
    const matched = new Set<number>();
    for (const tok of tokens) {
      for (const u of users) {
        if (u.id === user.id) continue;
        const nameLower = u.name.toLowerCase();
        const firstWord = nameLower.split(/\s+/)[0];
        const emailLocal = u.email.split("@")[0].toLowerCase();
        if (tok === nameLower || tok === firstWord || tok === emailLocal) {
          matched.add(u.id);
        }
      }
    }
    if (matched.size > 0) {
      await teamDb.from("tt_mentions").insert(
        Array.from(matched).map((uid) => ({
          comment_id: c.id,
          user_id: uid,
          task_id: task.id,
        })),
      );
    }
  }

  return NextResponse.json({ comment: c });
}
