"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMe } from "../../../team-shell";
import type { Sprint, Task } from "@/lib/team/types";

export default function SprintsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const me = useMe();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const canEdit = me?.user?.role === "admin" || me?.user?.role === "developer";

  async function load() {
    const [s, p] = await Promise.all([
      fetch(`/api/team/projects/${id}/sprints`).then((r) => r.json()),
      fetch(`/api/team/projects/${id}/tasks`).then((r) => r.json()),
    ]);
    setSprints(s.sprints || []);
    setTasks(p.tasks || []);
  }

  useEffect(() => {
    load();
  }, [id]);

  const tasksBySprint = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of tasks) {
      if (t.sprint_id == null) continue;
      if (!m.has(t.sprint_id)) m.set(t.sprint_id, []);
      m.get(t.sprint_id)!.push(t);
    }
    return m;
  }, [tasks]);

  async function startSprint(id: number) {
    const r = await fetch(`/api/team/sprints/${id}/start`, { method: "POST" });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Failed");
      return;
    }
    load();
  }

  async function completeSprint(id: number) {
    if (!confirm("Complete this sprint?")) return;
    const r = await fetch(`/api/team/sprints/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveTo: null }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Failed");
      return;
    }
    load();
  }

  async function deleteSprint(id: number) {
    if (!confirm("Delete this sprint?")) return;
    const r = await fetch(`/api/team/sprints/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Failed");
      return;
    }
    load();
  }

  const order: Sprint[] = [...sprints].sort((a, b) => {
    const stateOrder = { active: 0, planned: 1, completed: 2 } as const;
    if (a.state !== b.state) return stateOrder[a.state] - stateOrder[b.state];
    return a.position - b.position;
  });

  return (
    <div className="space-y-3">
      {order.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <p className="text-sm text-slate-500">No sprints yet.</p>
          <a href={`/team/projects/${id}/backlog`} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
            Create one from the backlog →
          </a>
        </div>
      )}
      {order.map((s) => {
        const ts = tasksBySprint.get(s.id) || [];
        const points = ts.reduce((sum, t) => sum + (t.story_points ?? 0), 0);
        const done = ts.filter((t) => t.status === "done").length;
        const donePct = ts.length > 0 ? Math.round((done / ts.length) * 100) : 0;
        return (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{s.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      s.state === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : s.state === "completed"
                          ? "bg-slate-200 text-slate-500"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {s.state}
                  </span>
                </div>
                {s.goal && <p className="mt-1 text-sm text-slate-600">{s.goal}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  {s.start_date && <>Start: {new Date(s.start_date).toLocaleDateString()} · </>}
                  {s.end_date && <>End: {new Date(s.end_date).toLocaleDateString()} · </>}
                  {ts.length} task{ts.length === 1 ? "" : "s"}
                  {points > 0 && ` · ${points} pts`}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  {s.state === "planned" && (
                    <>
                      <button
                        onClick={() => startSprint(s.id)}
                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => deleteSprint(s.id)}
                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {s.state === "active" && (
                    <button
                      onClick={() => completeSprint(s.id)}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Complete sprint
                    </button>
                  )}
                </div>
              )}
            </div>
            {ts.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Progress</span>
                  <span>
                    {done}/{ts.length} done · {donePct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${donePct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
