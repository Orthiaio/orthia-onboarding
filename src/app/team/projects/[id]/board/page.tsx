"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "../../../team-shell";
import {
  Avatar,
  LabelChip,
  PRIORITY_COLORS,
  TaskTypeIcon,
} from "@/lib/team/ui";
import type {
  Priority,
  Project,
  PublicUser,
  Sprint,
  Status,
  Task,
  TaskType,
} from "@/lib/team/types";

// Synthetic column representing tasks that aren't in any sprint.
// "backlog" is not a Status (statuses live on a task; sprint membership is
// a separate column). We treat it like a column for board UX only.
type ColumnKey = "backlog" | Status;
const COLUMNS: ColumnKey[] = ["backlog", "todo", "in_progress", "in_review", "in_uat", "done"];
const COLUMN_LABEL: Record<ColumnKey, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  in_uat: "UAT",
  done: "Done",
};
const COLUMN_ACCENT: Record<ColumnKey, string> = {
  backlog: "bg-zinc-400",
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-amber-500",
  in_uat: "bg-violet-500",
  done: "bg-emerald-500",
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
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  // Sprint filter only scopes the status columns (To Do → Done). The Backlog
  // column always shows sprint_id-null tasks regardless of filter.
  const [filterSprint, setFilterSprint] = useState<string>("active"); // 'active', 'all', 'backlog', or sprint id
  const [showCreate, setShowCreate] = useState<ColumnKey | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const canEdit = me?.user?.role === "admin" || me?.user?.role === "developer";

  async function load() {
    try {
      // Always fetch every task; we filter client-side so the Backlog column
      // can show non-sprint tasks alongside the selected sprint's status columns.
      const [pRes, uRes, sRes] = await Promise.all([
        fetch(`/api/team/projects/${id}/tasks?_=${Date.now()}`),
        fetch(`/api/team/users`),
        fetch(`/api/team/projects/${id}/sprints`),
      ]);
      if (!pRes.ok || !uRes.ok || !sRes.ok) {
        const failing = [pRes, uRes, sRes].find((r) => !r.ok);
        const d = await failing?.json().catch(() => ({}));
        alert(d?.error || "Could not load board. Please refresh.");
        setLoading(false);
        return;
      }
      const p = await pRes.json();
      const u = await uRes.json();
      const s = await sRes.json();
      setProject(p.project);
      setTasks(p.tasks || []);
      setUsers(u.users || []);
      setSprints(s.sprints || []);
      setAttachmentCounts(p.attachmentCounts || {});
      const hasActive = ((s.sprints || []) as Sprint[]).some((x) => x.state === "active");
      if (filterSprint === "active" && !hasActive) {
        setFilterSprint("all");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not load board.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filterSprint]);

  const userById = useMemo(() => {
    const m = new Map<number, PublicUser>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // Currently-selected sprint id used to scope the status columns. The
  // Backlog column does not depend on this — it always shows tasks with
  // sprint_id = null.
  const scopedSprintId: number | "all" = useMemo(() => {
    if (filterSprint === "all" || filterSprint === "backlog") return "all";
    if (filterSprint === "active") {
      return sprints.find((s) => s.state === "active")?.id ?? "all";
    }
    const n = Number(filterSprint);
    return Number.isFinite(n) ? n : "all";
  }, [filterSprint, sprints]);

  const tasksByColumn = useMemo(() => {
    const out: Record<ColumnKey, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      in_uat: [],
      done: [],
    };
    for (const t of tasks) {
      if (filterAssignee === "null" && t.assignee_id != null) continue;
      if (filterAssignee && filterAssignee !== "null" && String(t.assignee_id ?? "") !== filterAssignee)
        continue;
      if (t.sprint_id == null) {
        // Tasks with no sprint always go in the Backlog column regardless
        // of their status (a backlog item can be marked todo, in_progress, etc.).
        out.backlog.push(t);
        continue;
      }
      // Status columns only show tasks belonging to the scoped sprint.
      if (scopedSprintId !== "all" && t.sprint_id !== scopedSprintId) continue;
      out[t.status].push(t);
    }
    (Object.keys(out) as ColumnKey[]).forEach((k) =>
      out[k].sort((a, b) => a.position - b.position),
    );
    return out;
  }, [tasks, filterAssignee, scopedSprintId]);

  async function handleDrop(col: ColumnKey, index: number) {
    if (dragging === null) return;
    const taskId = dragging;
    setDragging(null);

    const source = tasks.find((t) => t.id === taskId);
    if (!source) return;

    // Drop into Backlog: clear sprint, keep current status. Drop into a
    // status column from Backlog: assign to the currently scoped sprint.
    // Drop within status columns: just change status.
    const droppingIntoBacklog = col === "backlog";
    const droppingIntoStatus = col !== "backlog";
    const newStatus: Status = droppingIntoBacklog ? source.status : (col as Status);

    let newSprintId: number | null | undefined = undefined;
    if (droppingIntoBacklog) {
      newSprintId = null;
    } else if (droppingIntoStatus && source.sprint_id == null) {
      // Coming out of backlog. Need a target sprint. Prefer the active
      // sprint, then the currently filtered sprint, else refuse.
      const targetSprintId =
        scopedSprintId !== "all"
          ? scopedSprintId
          : sprints.find((s) => s.state === "active")?.id ?? null;
      if (targetSprintId == null) {
        alert(
          "No active sprint to drop into. Start a sprint or pick one from the filter first.",
        );
        return;
      }
      newSprintId = targetSprintId;
    }

    // Skip no-op drops (same column + same position + no sprint change).
    if (
      source.status === newStatus &&
      source.position === index &&
      newSprintId === undefined &&
      (droppingIntoBacklog ? source.sprint_id == null : true)
    ) {
      return;
    }

    // Snapshot for rollback if the server rejects the move.
    const prevTasks = tasks;
    setTasks((prev) => {
      const without = prev.filter((t) => t.id !== taskId);
      const patched: Task = {
        ...source,
        status: newStatus,
        position: index,
        sprint_id: newSprintId === undefined ? source.sprint_id : newSprintId,
      };
      return [...without, patched];
    });

    const payload: Record<string, unknown> = { status: newStatus, position: index };
    if (newSprintId !== undefined) payload.sprint_id = newSprintId;

    const res = await fetch(`/api/team/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      load();
    } else {
      setTasks(prevTasks); // rollback
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Could not move task. Please try again.");
    }
  }

  async function createTask(col: ColumnKey, data: CreateTaskData) {
    // Backlog column → sprint_id null, status defaults to todo.
    // Status column → assign to current sprint scope (preferring an active
    // sprint if scope is "all"/"backlog"), keep the column's status.
    const isBacklog = col === "backlog";
    const status: Status = isBacklog ? "todo" : (col as Status);
    const sprint_id: number | null = isBacklog
      ? null
      : scopedSprintId !== "all"
        ? scopedSprintId
        : sprints.find((s) => s.state === "active")?.id ?? null;
    const res = await fetch(`/api/team/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, status, sprint_id }),
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

  async function uploadToTask(taskId: number, file: File): Promise<boolean> {
    if (file.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
      return false;
    }
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/team/tasks/${taskId}/attachments`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Upload failed.");
      return false;
    }
    load();
    return true;
  }

  const activeSprint = sprints.find((s) => s.state === "active") || null;

  return (
    <>
      {loading || !project ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterSprint}
                onChange={(e) => setFilterSprint(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                {activeSprint && <option value="active">Active sprint: {activeSprint.name}</option>}
                <option value="all">All sprints</option>
                <option value="backlog">Backlog (no sprint)</option>
                {sprints
                  .filter((s) => s.state !== "active")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.state}
                    </option>
                  ))}
              </select>
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
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {COLUMNS.map((col) => {
              const list = tasksByColumn[col];
              return (
                <div
                  key={col}
                  className="flex flex-col rounded-xl bg-slate-100/60"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col, list.length)}
                >
                  <div className="flex items-center justify-between px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${COLUMN_ACCENT[col]}`} />
                      <span className="text-sm font-semibold text-slate-800">
                        {COLUMN_LABEL[col]}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {list.length}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => setShowCreate(col)}
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
                          handleDrop(col, index);
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
                          assigneeName={userById.get(task.assignee_id ?? -1)?.name || null}
                          attachmentCount={attachmentCounts[task.id] || 0}
                          onUpload={(f) => uploadToTask(task.id, f)}
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
              status={showCreate === "backlog" ? "todo" : showCreate}
              columnLabel={COLUMN_LABEL[showCreate]}
              users={users}
              sprints={sprints}
              defaultAssigneeId={me?.user?.id ?? null}
              defaultSprintId={
                showCreate === "backlog"
                  ? null
                  : scopedSprintId !== "all"
                    ? scopedSprintId
                    : activeSprint?.id ?? null
              }
              onClose={() => setShowCreate(null)}
              onSubmit={(d) => createTask(showCreate, d)}
            />
          )}
        </>
      )}
    </>
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
  assigneeName,
  attachmentCount,
  onUpload,
}: {
  task: Task;
  project: Project;
  users: PublicUser[];
  canEdit: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onChange: (p: Partial<Task>) => void;
  assigneeName: string | null;
  attachmentCount: number;
  onUpload: (f: File) => Promise<boolean>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TaskTypeIcon type={task.type} />
          <span className="font-mono text-[11px] font-semibold text-slate-400">
            {project.key}-{task.number}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {task.blocked && (
            <span
              title={task.blocked_reason || "Blocked"}
              className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"
            >
              Blocked
            </span>
          )}
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              PRIORITY_COLORS[task.priority]
            }`}
          >
            {task.priority}
          </span>
        </div>
      </div>
      <a
        href={`/team/tasks/${task.id}`}
        className="mt-2 block text-sm font-medium text-slate-900 hover:text-slate-700"
      >
        {task.title}
      </a>
      {task.labels && task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 4).map((l) => (
            <LabelChip key={l} label={l} />
          ))}
          {task.labels.length > 4 && (
            <span className="text-[10px] text-slate-400">+{task.labels.length - 4}</span>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
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
            <span className="text-xs text-slate-500">{assigneeName || "Unassigned"}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  await onUpload(f);
                  setBusy(false);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                title={
                  attachmentCount > 0
                    ? `${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}`
                    : "Upload PDF"
                }
                disabled={busy}
                className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <span aria-hidden>📎</span>
                {attachmentCount > 0 && (
                  <span className="font-medium">{attachmentCount}</span>
                )}
              </button>
            </>
          )}
          {task.story_points != null && (
            <span
              title="Story points"
              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
            >
              {task.story_points}
            </span>
          )}
          <Avatar name={assigneeName} userId={task.assignee_id} size={6} />
          {task.due_date && (
            <span className="text-[10px] text-slate-500">
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateTaskData {
  title: string;
  description?: string;
  priority: Priority;
  type: TaskType;
  assignee_id: number | null;
  reporter_id: number | null;
  due_date: string | null;
  start_date: string | null;
  sprint_id: number | null;
  story_points: number | null;
  labels: string[];
}

function CreateTaskModal({
  status,
  columnLabel,
  users,
  sprints,
  defaultAssigneeId,
  defaultSprintId,
  onClose,
  onSubmit,
}: {
  status: Status;
  columnLabel: string;
  users: PublicUser[];
  sprints: Sprint[];
  defaultAssigneeId: number | null;
  defaultSprintId: number | null;
  onClose: () => void;
  onSubmit: (d: CreateTaskData) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [type, setType] = useState<TaskType>("task");
  const [assigneeId, setAssigneeId] = useState<number | null>(defaultAssigneeId);
  const [reporterId, setReporterId] = useState<number | null>(defaultAssigneeId);
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [sprintId, setSprintId] = useState<number | null>(defaultSprintId);
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [labelInput, setLabelInput] = useState("");

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
          const labels = labelInput
            .split(",")
            .map((l) => l.trim())
            .filter((l) => l);
          const sp = storyPoints === "" ? null : Number(storyPoints);
          onSubmit({
            title: title.trim(),
            description: description || undefined,
            priority,
            type,
            assignee_id: assigneeId,
            reporter_id: reporterId,
            due_date: dueDate || null,
            start_date: startDate || null,
            sprint_id: sprintId,
            story_points: Number.isFinite(sp as number) ? (sp as number) : null,
            labels,
          });
        }}
        className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New task</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {columnLabel}
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
          <span className="block text-xs font-medium text-slate-600">Description (markdown)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TaskType)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="task">Task</option>
              <option value="story">Story</option>
              <option value="bug">Bug</option>
              <option value="epic">Epic</option>
              <option value="subtask">Subtask</option>
            </select>
          </label>
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
            <span className="block text-xs font-medium text-slate-600">Reporter</span>
            <select
              value={reporterId ?? ""}
              onChange={(e) => setReporterId(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
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
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Sprint</span>
            <select
              value={sprintId ?? ""}
              onChange={(e) => setSprintId(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Backlog</option>
              {sprints
                .filter((s) => s.state !== "completed")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.state}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Story points</span>
            <input
              type="number"
              min={0}
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Labels (comma-separated)
          </span>
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="frontend, needs-review"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
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
            Create task
          </button>
        </div>
      </form>
    </div>
  );
}
