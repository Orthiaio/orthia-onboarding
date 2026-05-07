"use client";

import { useEffect, useMemo, useState } from "react";
import TeamShell, { useMe } from "../team-shell";
import {
  Avatar,
  STATUS_BG,
  STATUS_LABEL,
  TaskTypeIcon,
} from "@/lib/team/ui";
import type { Priority, Project, PublicUser, Status, TaskType } from "@/lib/team/types";

interface BlockerEntry {
  task: {
    id: number;
    number: number;
    title: string;
    status: Status;
    type: TaskType;
    priority: Priority;
    assignee_id: number | null;
    reporter_id: number | null;
    creator_id: number;
    blocked: boolean;
    blocked_reason: string | null;
    created_at: string;
    updated_at: string;
  };
  project: { id: number; key: string; name: string };
}

export default function BlockersPage() {
  const me = useMe();
  const [blockers, setBlockers] = useState<BlockerEntry[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const canEdit = me?.user?.role === "admin" || me?.user?.role === "developer";

  async function load() {
    setError(null);
    try {
      const [bRes, uRes, pRes] = await Promise.all([
        fetch("/api/team/blockers"),
        fetch("/api/team/users"),
        fetch("/api/team/projects"),
      ]);
      if (!bRes.ok) {
        const d = await bRes.json().catch(() => ({}));
        setError(d.error || "Could not load blockers");
        setLoading(false);
        return;
      }
      const b = await bRes.json();
      const u = await uRes.json();
      const p = await pRes.json();
      setBlockers(b.blockers || []);
      setUsers(u.users || []);
      setProjects(p.projects || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const userById = useMemo(() => {
    const m = new Map<number, PublicUser>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  async function unblock(taskId: number) {
    if (!confirm("Mark this as no longer blocking?")) return;
    const r = await fetch(`/api/team/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: false, blocked_reason: null }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Could not resolve");
      return;
    }
    load();
  }

  return (
    <TeamShell title="Blockers">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {blockers.length === 0
            ? "Nothing is blocking right now."
            : `${blockers.length} active blocker${blockers.length === 1 ? "" : "s"} across all projects.`}
        </p>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            + Post blocker
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : blockers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <p className="text-sm text-slate-500">All clear.</p>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
            >
              Post a blocker →
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {blockers.map((b) => {
            const a = b.task.assignee_id ? userById.get(b.task.assignee_id) : null;
            const reporter = b.task.creator_id ? userById.get(b.task.creator_id) : null;
            return (
              <li
                key={b.task.id}
                className="flex flex-wrap items-start gap-3 rounded-xl border border-red-200 bg-white p-4"
              >
                <span className="mt-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                  Blocked
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <TaskTypeIcon type={b.task.type} />
                    <a
                      href={`/team/projects/${b.project.id}/board`}
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      {b.project.key}
                    </a>
                    <span className="font-mono">
                      {b.project.key}-{b.task.number}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG[b.task.status]}`}
                    >
                      {STATUS_LABEL[b.task.status]}
                    </span>
                    <span className="text-slate-400">
                      · updated {new Date(b.task.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <a
                    href={`/team/tasks/${b.task.id}`}
                    className="mt-1 block text-sm font-semibold text-slate-900 hover:text-slate-600"
                  >
                    {b.task.title}
                  </a>
                  {b.task.blocked_reason && (
                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-semibold">Reason:</span>{" "}
                      {b.task.blocked_reason}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    {a && (
                      <span className="flex items-center gap-1">
                        <Avatar name={a.name} userId={a.id} size={5} /> {a.name}
                      </span>
                    )}
                    {reporter && (
                      <span>posted by {reporter.name}</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => unblock(b.task.id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    Resolve
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <PostBlockerModal
          projects={projects}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </TeamShell>
  );
}

function PostBlockerModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId) {
      setError("Pick a project.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/team/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: reason.trim() || null,
          type: "task",
          blocked: true,
          blocked_reason: reason.trim() || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Could not create");
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-slate-900">Post blocker</h2>
        <p className="text-sm text-slate-500">
          Creates a task flagged as <span className="font-semibold text-red-700">Blocked</span> so
          everyone sees it on the board, backlog, and this page.
        </p>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Pick a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What can't proceed?"
            required
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Reason / details</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="What's blocking? Who's needed to unblock? Any context."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post blocker"}
          </button>
        </div>
      </form>
    </div>
  );
}
