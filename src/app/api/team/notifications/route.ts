import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";

interface MentionRow {
  id: number;
  read_at: string | null;
  created_at: string;
  task_id: number;
  comment_id: number;
  tt_tasks: { id: number; title: string; number: number; tt_projects: { key: string } };
  tt_comments: { body: string; author_id: number };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  if (unreadOnly) {
    const { count } = await teamDb
      .from("tt_mentions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    return NextResponse.json({ unread: count ?? 0 });
  }

  const { data } = await teamDb
    .from("tt_mentions")
    .select(
      "id,read_at,created_at,task_id,comment_id, tt_tasks!inner(id,title,number,tt_projects!inner(key)), tt_comments!inner(body,author_id)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  const mentions = (data || []) as unknown as MentionRow[];
  const authorIds = Array.from(new Set(mentions.map((m) => m.tt_comments.author_id)));
  const { data: authors } = authorIds.length
    ? await teamDb.from("tt_users").select("id,name").in("id", authorIds)
    : { data: [] as { id: number; name: string }[] };
  const authorName = new Map((authors || []).map((a) => [a.id, a.name]));

  const notifications = mentions.map((m) => ({
    id: m.id,
    task_id: m.task_id,
    task_title: m.tt_tasks.title,
    task_number: m.tt_tasks.number,
    project_key: m.tt_tasks.tt_projects.key,
    body: m.tt_comments.body,
    author_name: authorName.get(m.tt_comments.author_id) || "Someone",
    created_at: m.created_at,
    read_at: m.read_at,
  }));
  return NextResponse.json({ notifications });
}

// Mark all as read
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { error } = await teamDb
    .from("tt_mentions")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
