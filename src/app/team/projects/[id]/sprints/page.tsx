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
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [editingRetro, setEditingRetro] = useState<Sprint | null>(null);
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

  async function submitComplete(opts: {
    moveTo: number | null;
    retroNotes: string;
  }) {
    if (!completing) return;
    const r = await fetch(`/api/team/sprints/${completing.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moveTo: opts.moveTo,
        retro_notes: opts.retroNotes.trim() || null,
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Failed");
      return;
    }
    setCompleting(null);
    load();
  }

  async function saveRetro(sprint: Sprint, retroNotes: string) {
    const r = await fetch(`/api/team/sprints/${sprint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retro_notes: retroNotes.trim() || null }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Failed");
      return;
    }
    setEditingRetro(null);
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
        const incomplete = ts.length - done;
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
                      onClick={() => setCompleting(s)}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Complete sprint
                    </button>
                  )}
                  {s.state === "completed" && (
                    <button
                      onClick={() => setEditingRetro(s)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {s.retro_notes ? "Edit retro" : "Add retro"}
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
                {s.state === "active" && incomplete > 0 && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {incomplete} task{incomplete === 1 ? "" : "s"} still
                    incomplete — on completion you can carry them forward or
                    send them back to the backlog.
                  </p>
                )}
              </div>
            )}
            {s.state === "completed" && s.retro_notes && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Retrospective
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {s.retro_notes}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {completing && (
        <CompleteSprintModal
          sprint={completing}
          incompleteCount={
            (tasksBySprint.get(completing.id) || []).filter(
              (t) => t.status !== "done",
            ).length
          }
          plannedSprints={sprints.filter(
            (x) => x.state === "planned" && x.id !== completing.id,
          )}
          onClose={() => setCompleting(null)}
          onSubmit={submitComplete}
        />
      )}

      {editingRetro && (
        <RetroEditorModal
          sprint={editingRetro}
          onClose={() => setEditingRetro(null)}
          onSubmit={(notes) => saveRetro(editingRetro, notes)}
        />
      )}
    </div>
  );
}

function CompleteSprintModal({
  sprint,
  incompleteCount,
  plannedSprints,
  onClose,
  onSubmit,
}: {
  sprint: Sprint;
  incompleteCount: number;
  plannedSprints: Sprint[];
  onClose: () => void;
  onSubmit: (opts: { moveTo: number | null; retroNotes: string }) => void;
}) {
  // Default: send incomplete tasks to the next planned sprint if one exists,
  // otherwise to the backlog. Users can override.
  const nextSprint = plannedSprints[0] ?? null;
  const [moveTo, setMoveTo] = useState<string>(
    nextSprint ? String(nextSprint.id) : "",
  );
  const [retroNotes, setRetroNotes] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            moveTo: moveTo === "" ? null : Number(moveTo),
            retroNotes,
          });
        }}
        className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Complete sprint
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {sprint.name}
            {incompleteCount > 0
              ? ` · ${incompleteCount} task${
                  incompleteCount === 1 ? "" : "s"
                } not done`
              : " · all tasks done"}
          </p>
        </div>

        {incompleteCount > 0 && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Move incomplete tasks to
            </span>
            <select
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Backlog (no sprint)</option>
              {plannedSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (planned)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Done tasks always stay attached to this completed sprint.
            </p>
          </label>
        )}

        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Sprint retrospective
          </span>
          <textarea
            value={retroNotes}
            onChange={(e) => setRetroNotes(e.target.value)}
            rows={6}
            placeholder={`What went well?\nWhat could improve?\nAction items for next sprint?`}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Optional — you can also add or edit the retro after completing.
          </p>
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Complete sprint
          </button>
        </div>
      </form>
    </div>
  );
}

function RetroEditorModal({
  sprint,
  onClose,
  onSubmit,
}: {
  sprint: Sprint;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(sprint.retro_notes ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(notes);
        }}
        className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Sprint retrospective
          </h2>
          <p className="mt-1 text-sm text-slate-500">{sprint.name}</p>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={10}
          placeholder={`What went well?\nWhat could improve?\nAction items for next sprint?`}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoFocus
        />
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Save retro
          </button>
        </div>
      </form>
    </div>
  );
}
