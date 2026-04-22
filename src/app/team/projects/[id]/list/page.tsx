"use client";

import { use, useEffect, useMemo, useState } from "react";
import TeamShell from "../../../team-shell";
import type { Priority, Project, PublicUser, Status, Task } from "@/lib/team/types";

type SortKey = "due_date" | "priority" | "assignee" | "status";

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};
const STATUS_COLOR: Record<Status, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};
const PRIORITY_COLOR: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default function ProjectListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [sort, setSort] = useState<SortKey>("due_date");

  useEffect(() => {
    Promise.all([
      fetch(`/api/team/projects/${id}/tasks`).then((r) => r.json()),
      fetch(`/api/team/users`).then((r) => r.json()),
    ]).then(([p, u]) => {
      setProject(p.project);
      setTasks(p.tasks || []);
      setUsers(u.users || []);
    });
  }, [id]);

  const userById = useMemo(() => {
    const m = new Map<number, PublicUser>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "assignee") {
        const na = userById.get(a.assignee_id ?? -1)?.name || "";
        const nb = userById.get(b.assignee_id ?? -1)?.name || "";
        return na.localeCompare(nb);
      }
      // due_date: nulls last, then ascending
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return arr;
  }, [tasks, sort, userById]);

  return (
    <TeamShell>
      {!project ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <a href="/team/projects" className="text-xs text-slate-500 hover:text-slate-700">
                ← Projects
              </a>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                  {project.key}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {project.name}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="due_date">Sort: Due date</option>
                <option value="priority">Sort: Priority</option>
                <option value="assignee">Sort: Assignee</option>
                <option value="status">Sort: Status</option>
              </select>
              <a
                href={`/team/projects/${id}/board`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Board view
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Assignee</th>
                  <th className="px-4 py-2.5">Due</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No tasks.
                    </td>
                  </tr>
                )}
                {sorted.map((t) => {
                  const a = userById.get(t.assignee_id ?? -1);
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        {project.key}-{t.number}
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={`/team/tasks/${t.id}`}
                          className="font-medium text-slate-900 hover:text-slate-700"
                        >
                          {t.title}
                        </a>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            STATUS_COLOR[t.status]
                          }`}
                        >
                          {STATUS_LABEL[t.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                            PRIORITY_COLOR[t.priority]
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{a?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </TeamShell>
  );
}
