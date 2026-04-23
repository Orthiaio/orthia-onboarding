"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  LabelChip,
  PRIORITY_COLORS,
  STATUS_BG,
  STATUS_LABEL,
  TaskTypeIcon,
} from "@/lib/team/ui";
import type { Priority, Project, PublicUser, Status, Task } from "@/lib/team/types";

type SortKey = "due_date" | "priority" | "assignee" | "status" | "story_points";
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

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
      if (sort === "story_points") {
        const ap = a.story_points ?? -1;
        const bp = b.story_points ?? -1;
        return bp - ap;
      }
      if (sort === "assignee") {
        const na = userById.get(a.assignee_id ?? -1)?.name || "";
        const nb = userById.get(b.assignee_id ?? -1)?.name || "";
        return na.localeCompare(nb);
      }
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return arr;
  }, [tasks, sort, userById]);

  if (!project) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="due_date">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="story_points">Sort: Story points</option>
          <option value="assignee">Sort: Assignee</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">ID</th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="px-4 py-2.5">SP</th>
              <th className="px-4 py-2.5">Assignee</th>
              <th className="px-4 py-2.5">Due</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No tasks.
                </td>
              </tr>
            )}
            {sorted.map((t) => {
              const a = userById.get(t.assignee_id ?? -1);
              return (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <TaskTypeIcon type={t.type} />
                  </td>
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
                    {t.labels && t.labels.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.labels.map((l) => (
                          <LabelChip key={l} label={l} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        STATUS_BG[t.status as Status]
                      }`}
                    >
                      {STATUS_LABEL[t.status as Status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        PRIORITY_COLORS[t.priority]
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                    {t.story_points ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={a?.name} userId={t.assignee_id} size={6} />
                      <span className="text-slate-700">{a?.name || "—"}</span>
                    </div>
                  </td>
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
  );
}
