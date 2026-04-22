"use client";

import { use, useEffect, useMemo, useState } from "react";
import TeamShell, { useMe } from "../../../team-shell";
import type { Priority, Project, PublicUser, Status, Task } from "@/lib/team/types";

const COLUMNS: { status: Status; label: string; accent: string }[] = [
  { status: "todo", label: "To Do", accent: "bg-slate-400" },
  { status: "in_progress", label: "In Progress", accent: "bg-blue-500" },
  { status: "done", label: "Done", accent: "bg-emerald-500" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const me = useMe();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [showCreate, setShowCreate] = useState<Status | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const canEdit = me?.user?.role === "admin" || me?.user?.role === "developer";

  async function load() {
    const [pRes, uRes] = await Promise.all([
      fetch(`/api/team/projects/${id}/tasks`),
      fetch(`/api/team/users`),
    ]);
    const p = await pRes.json();
    const u = await uRes.json();
    setProject(p.project);
    setTasks(p.tasks || []);
    setUsers(u.users || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  const tasksByStatus = useMemo(() => {
    const out: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) {
      if (filterAssignee && String(t.assignee_id ?? "") !== filterAssignee) continue;
      out[t.status].push(t);
    }
    (Object.keys(out) as Status[]).forEach((k) =>
      out[k].sort((a, b) => a.position - b.position),
    );
    return out;
  }, [tasks, filterAssignee]);

  async function handleDrop(status: Status, index: number) {
    if (dragging === null) return;
    const taskId = dragging;
    setDragging(null);

    // Optimistic update
    const source = tasks.find((t) => t.id === taskId);
    if (!source) return;

    setTasks((prev) => {
      const without = prev.filter((t) => t.id !== taskId);
      const moved: Task = { ...source, status, position: index };
      // Remove any lingering position collisions by letting the server fix it;
      // the UI will re-render from the response.
      return [...without, moved];
    });

    const res = await fetch(`/api/team/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, position: index }),
    });
    if (res.ok) {
      load();
    }
  }

  async function createTask(status: Status, data: CreateTaskData) {
    const res = await fetch(`/api/team/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, status }),
    });
    if (res.ok) {
      setShowCreate(null);
      load();
    }
  }

  async function updateTask(taskId: number, patch: Partial<Task>) {
    await fetch(`/api/team/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  return (
    <TeamShell>
      {loading || !project ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <a href="/team/projects" className="text-xs text-slate-500 hover:text-slate-700">
                  ← Projects
                </a>
              </div>
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
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All assignees</option>
                <option value="null">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <a
                href={`/team/projects/${id}/list`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                List view
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const list = tasksByStatus[col.status];
              return (
                <div
                  key={col.status}
                  className="flex flex-col rounded-xl bg-slate-100/60"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col.status, list.length)}
                >
                  <div className="flex items-center justify-between px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                      <span className="text-sm font-semibold text-slate-800">{col.label}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {list.length}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => setShowCreate(col.status)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
                        aria-label="Add task"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <div className="flex min-h-24 flex-col gap-2 px-3 pb-3">
                    {list.map((task, index) => (
                      <div
                        key={task.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleDrop(col.status, index);
                        }}
                      >
                        <TaskCard
                          task={task}
                          project={project}
                          users={users}
                          canEdit={canEdit}
                          onDragStart={() => setDragging(task.id)}
                          onDragEnd={() => setDragging(null)}
                          onChange={(patch) => updateTask(task.id, patch)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {showCreate && (
            <CreateTaskModal
              status={showCreate}
              users={users}
              defaultAssigneeId={me?.user?.id ?? null}
              onClose={() => setShowCreate(null)}
              onSubmit={(d) => createTask(showCreate, d)}
            />
          )}
        </>
      )}
    </TeamShell>
  );
}

function TaskCard({
  task,
  project,
  users,
  canEdit,
  onDragStart,
  onDragEnd,
  onChange,
}: {
  task: Task;
  project: Project;
  users: PublicUser[];
  canEdit: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onChange: (p: Partial<Task>) => void;
}) {
  const assignee = users.find((u) => u.id === task.assignee_id);
  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-slate-400">
          {project.key}-{task.number}
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            PRIORITY_COLORS[task.priority]
          }`}
        >
          {task.priority}
        </span>
      </div>
      <a
        href={`/team/tasks/${task.id}`}
        className="mt-2 block text-sm font-medium text-slate-900 hover:text-slate-700"
      >
        {task.title}
      </a>
      <div className="mt-3 flex items-center justify-between">
        {canEdit ? (
          <select
            value={task.assignee_id ?? ""}
            onChange={(e) =>
              onChange({ assignee_id: e.target.value ? Number(e.target.value) : null } as Partial<Task>)
            }
            onClick={(e) => e.stopPropagation()}
            className="max-w-[9rem] truncate rounded-md border-0 bg-transparent text-xs text-slate-600 focus:ring-1 focus:ring-slate-300"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-500">{assignee?.name || "Unassigned"}</span>
        )}
        {task.due_date && (
          <span className="text-[10px] text-slate-500">
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

interface CreateTaskData {
  title: string;
  description?: string;
  priority: Priority;
  assignee_id: number | null;
  due_date: string | null;
}

function CreateTaskModal({
  status,
  users,
  defaultAssigneeId,
  onClose,
  onSubmit,
}: {
  status: Status;
  users: PublicUser[];
  defaultAssigneeId: number | null;
  onClose: () => void;
  onSubmit: (d: CreateTaskData) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState<number | null>(defaultAssigneeId);
  const [dueDate, setDueDate] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({
            title: title.trim(),
            description: description || undefined,
            priority,
            assignee_id: assigneeId,
            due_date: dueDate || null,
          });
        }}
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New task</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {status === "todo" ? "To Do" : status === "in_progress" ? "In Progress" : "Done"}
          </span>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Description (markdown)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Assignee</span>
            <select
              value={assigneeId ?? ""}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
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
            className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Create task
          </button>
        </div>
      </form>
    </div>
  );
}
