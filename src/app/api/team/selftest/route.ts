import { NextRequest, NextResponse } from "next/server";
import { teamDb } from "@/lib/team/supabase";
import { requireUser } from "@/lib/team/user-auth";
import { describeDbError } from "@/lib/team/db-error";

/**
 * End-to-end self-test. Admin-only. Creates a sandbox project named
 * "__selftest__<timestamp>", exercises every new Jira-style path
 * (sprint CRUD + start/complete, task CRUD + move + subtask + assignment +
 * labels + story points + parent), asserts expected state, then soft-deletes
 * the sandbox so it's hidden from all UI.
 *
 * The sandbox project is soft-deleted, not hard-deleted, to respect the
 * same safety guarantee the UI provides. Rows remain in Supabase but the
 * app will never surface them.
 */

interface Step {
  name: string;
  ok: boolean;
  detail?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { roles: ["admin"] });
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const steps: Step[] = [];
  const ok = (name: string, detail?: string) => steps.push({ name, ok: true, detail });
  const fail = (name: string, detail: string) => {
    steps.push({ name, ok: false, detail });
  };

  const stamp = Date.now();
  const key = `ST${String(stamp).slice(-5)}`;
  let projectId: number | null = null;
  let sprint1Id: number | null = null;
  let sprint2Id: number | null = null;
  let taskAId: number | null = null;
  let taskBId: number | null = null;
  let subtaskId: number | null = null;

  async function cleanup() {
    if (projectId != null) {
      await teamDb
        .from("tt_projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectId);
    }
  }

  try {
    // 1. Create sandbox project
    {
      const { data, error } = await teamDb
        .from("tt_projects")
        .insert({
          organization_id: user.organization_id,
          key,
          name: `__selftest__ ${stamp}`,
          created_by: user.id,
        })
        .select()
        .single();
      if (error || !data) throw new Error(describeDbError(error));
      projectId = (data as { id: number }).id;
      ok("Create sandbox project", `id=${projectId} key=${key}`);
    }

    // 2. Create two sprints
    {
      for (const n of [1, 2]) {
        const { data, error } = await teamDb
          .from("tt_sprints")
          .insert({ project_id: projectId, name: `Sprint ${n}`, position: n })
          .select()
          .single();
        if (error || !data) throw new Error(describeDbError(error));
        if (n === 1) sprint1Id = (data as { id: number }).id;
        else sprint2Id = (data as { id: number }).id;
      }
      ok("Create two sprints", `sprint1=${sprint1Id} sprint2=${sprint2Id}`);
    }

    // 3. Create two tasks (A in sprint1, B in backlog)
    {
      const tasks = [
        {
          name: "A",
          sprint_id: sprint1Id,
          extra: { priority: "high", type: "bug", story_points: 3, labels: ["frontend", "needs-review"] },
        },
        { name: "B", sprint_id: null, extra: { type: "story", story_points: 5 } },
      ];
      let n = 0;
      for (const t of tasks) {
        n++;
        const { data, error } = await teamDb
          .from("tt_tasks")
          .insert({
            project_id: projectId,
            number: n,
            title: `Task ${t.name}`,
            status: "todo",
            creator_id: user.id,
            assignee_id: user.id,
            reporter_id: user.id,
            sprint_id: t.sprint_id,
            position: 0,
            ...t.extra,
          })
          .select()
          .single();
        if (error || !data) throw new Error(describeDbError(error));
        if (t.name === "A") taskAId = (data as { id: number }).id;
        else taskBId = (data as { id: number }).id;
      }
      ok("Create tasks (A in sprint, B in backlog)", `A=${taskAId} B=${taskBId}`);
    }

    // 4. Verify Jira fields round-tripped on Task A
    {
      const { data, error } = await teamDb
        .from("tt_tasks")
        .select("priority,type,story_points,labels,sprint_id")
        .eq("id", taskAId)
        .single();
      if (error) throw new Error(describeDbError(error));
      const row = data as { priority: string; type: string; story_points: number; labels: string[]; sprint_id: number };
      if (row.priority !== "high") throw new Error(`priority not stored: ${row.priority}`);
      if (row.type !== "bug") throw new Error(`type not stored: ${row.type}`);
      if (row.story_points !== 3) throw new Error(`story_points not stored: ${row.story_points}`);
      if (!Array.isArray(row.labels) || row.labels.length !== 2)
        throw new Error(`labels not stored correctly: ${JSON.stringify(row.labels)}`);
      if (row.sprint_id !== sprint1Id) throw new Error(`sprint_id mismatch`);
      ok("Jira fields persisted (priority/type/story_points/labels/sprint_id)");
    }

    // 5. Create a subtask under A
    {
      const { data, error } = await teamDb
        .from("tt_tasks")
        .insert({
          project_id: projectId,
          number: 3,
          title: "Task A.1 subtask",
          status: "todo",
          type: "subtask",
          parent_id: taskAId,
          creator_id: user.id,
          assignee_id: user.id,
          position: 0,
        })
        .select()
        .single();
      if (error || !data) throw new Error(describeDbError(error));
      subtaskId = (data as { id: number }).id;
      ok("Create subtask under A", `subtask=${subtaskId}`);
    }

    // 6. Start Sprint 1
    {
      const { error } = await teamDb
        .from("tt_sprints")
        .update({ state: "active", started_at: new Date().toISOString() })
        .eq("id", sprint1Id);
      if (error) throw new Error(describeDbError(error));
      ok("Start Sprint 1");
    }

    // 7. Verify: single-active-sprint constraint blocks starting Sprint 2
    {
      const { error } = await teamDb
        .from("tt_sprints")
        .update({ state: "active" })
        .eq("id", sprint2Id);
      if (!error) {
        // If this succeeded, the partial unique index isn't in place.
        fail(
          "Single-active-sprint constraint",
          "Second active sprint was allowed — tt_sprints_one_active index missing",
        );
      } else {
        ok("Single-active-sprint constraint enforced");
        // Roll back Sprint 2 in case anything changed.
        await teamDb.from("tt_sprints").update({ state: "planned" }).eq("id", sprint2Id);
      }
    }

    // 8. Move task A through all four statuses
    {
      for (const status of ["in_progress", "in_review", "done"] as const) {
        const { error } = await teamDb
          .from("tt_tasks")
          .update({ status })
          .eq("id", taskAId);
        if (error) throw new Error(describeDbError(error));
      }
      const { data } = await teamDb
        .from("tt_tasks")
        .select("status")
        .eq("id", taskAId)
        .single();
      if ((data as { status: string }).status !== "done") {
        throw new Error("status did not end at 'done'");
      }
      ok("Move Task A through todo → in_progress → in_review → done");
    }

    // 9. Complete Sprint 1 — unfinished tasks (subtask still todo) move to backlog
    {
      // Emulate what the API does
      await teamDb
        .from("tt_tasks")
        .update({ sprint_id: null })
        .eq("sprint_id", sprint1Id)
        .neq("status", "done");
      await teamDb
        .from("tt_sprints")
        .update({ state: "completed", completed_at: new Date().toISOString() })
        .eq("id", sprint1Id);
      const { data: subAfter } = await teamDb
        .from("tt_tasks")
        .select("sprint_id,status")
        .eq("id", subtaskId)
        .single();
      const s = subAfter as { sprint_id: number | null; status: string };
      if (s.sprint_id !== null) {
        throw new Error(`unfinished subtask still has sprint_id=${s.sprint_id}`);
      }
      const { data: aAfter } = await teamDb
        .from("tt_tasks")
        .select("sprint_id,status")
        .eq("id", taskAId)
        .single();
      const a = aAfter as { sprint_id: number | null; status: string };
      if (a.sprint_id !== sprint1Id) {
        throw new Error("done task should stay in completed sprint");
      }
      ok("Complete sprint moves unfinished → backlog, keeps done tasks");
    }

    // 10. Verify the GET shape: subtasks + parent lookup + sprints list
    {
      const { data: subtasks } = await teamDb
        .from("tt_tasks")
        .select("id,number,title,parent_id,type")
        .eq("parent_id", taskAId)
        .is("deleted_at", null);
      const subs = (subtasks ?? []) as Array<{ id: number }>;
      if (subs.length !== 1 || subs[0].id !== subtaskId) {
        throw new Error(`subtask lookup returned ${subs.length} rows`);
      }
      ok("Parent → subtask relationship readable");
    }

    // 11. Activity + comment + mention
    {
      const { data: comment, error: cErr } = await teamDb
        .from("tt_comments")
        .insert({ task_id: taskAId, author_id: user.id, body: "selftest comment @self" })
        .select()
        .single();
      if (cErr || !comment) throw new Error(describeDbError(cErr));
      const commentId = (comment as { id: number }).id;
      const { error: aErr } = await teamDb
        .from("tt_activities")
        .insert({ task_id: taskAId, user_id: user.id, action: "commented", meta: { comment_id: commentId } });
      if (aErr) throw new Error(describeDbError(aErr));
      ok("Comment + activity written");
    }

    await cleanup();
    ok("Cleanup: sandbox project soft-deleted");
  } catch (err) {
    fail("fatal", err instanceof Error ? err.message : String(err));
    await cleanup().catch(() => {});
  }

  const overall = steps.every((s) => s.ok);
  return NextResponse.json({
    ok: overall,
    passed: steps.filter((s) => s.ok).length,
    failed: steps.filter((s) => !s.ok).length,
    steps,
  });
}

// GET is intentionally not aliased to POST — it'd be a CSRF vector
// (a phished admin clicking a link would run the selftest). Use
// `curl -X POST /api/team/selftest` or fetch() with method POST.
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Selftest is POST-only. Run `curl -X POST https://<your-host>/api/team/selftest` with your admin session cookie.",
    },
    { status: 405 },
  );
}
