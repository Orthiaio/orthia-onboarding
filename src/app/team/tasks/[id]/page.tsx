"use client";

import { use, useEffect, useState } from "react";
import TeamShell, { useMe } from "../../team-shell";
import { renderMarkdown } from "@/lib/team/markdown";
import {
  Avatar,
  LabelChip,
  STATUS_BG,
  STATUS_LABEL,
  TASK_TYPE_META,
  TaskTypeIcon,
} from "@/lib/team/ui";
import type {
  Activity,
  Comment,
  Priority,
  PublicUser,
  Sprint,
  Status,
  Task,
  TaskType,
} from "@/lib/team/types";

interface Subtask {
  id: number;
  number: number;
  title: string;
  status: Status;
  assignee_id: number | null;
  type: TaskType;
}

interface DetailResponse {
  task: Task;
  project: { id: number; key: string; organization_id: number };
  comments: Comment[];
  activities: Activity[];
  users: PublicUser[];
  subtasks: Subtask[];
  sprints: Sprint[];
  parent: { id: number; number: number; title: string; status: Status; type: TaskType } | null;
}

type ActivityTab = "all" | "comments" | "history";

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const me = useMe();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [activityTab, setActivityTab] = useState<ActivityTab>("all");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const canEdit =
    me?.user?.role === "admin" || me?.user?.role === "developer";

  async function load() {
    const r = await fetch(`/api/team/tasks/${id}`);
    if (!r.ok) return;
    const d: DetailResponse = await r.json();
    setData(d);
    setDescDraft(d.task.description || "");
    setTitleDraft(d.task.title);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/team/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function moveStatus(status: Status) {
    if (!data) return;
    await fetch(`/api/team/tasks/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, position: 0 }),
    });
    load();
  }

  async function sendComment() {
    const body = commentDraft.trim();
    if (!body) return;
    const res = await fetch(`/api/team/tasks/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Could not post comment. Please try again.");
      return; // keep the draft so the user doesn't lose their text
    }
    setCommentDraft("");
    load();
  }

  async function saveCommentEdit(cid: number) {
    await fetch(`/api/team/comments/${cid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editCommentDraft }),
    });
    setEditingCommentId(null);
    load();
  }

  async function deleteComment(cid: number) {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/team/comments/${cid}`, { method: "DELETE" });
    load();
  }

  async function addLabel() {
    if (!data) return;
    const clean = labelInput.trim();
    if (!clean) return;
    const next = Array.from(new Set([...(data.task.labels || []), clean]));
    await patch({ labels: next });
    setLabelInput("");
  }

  async function removeLabel(l: string) {
    if (!data) return;
    const next = (data.task.labels || []).filter((x) => x !== l);
    await patch({ labels: next });
  }

  async function createSubtask() {
    if (!data || !newSubtaskTitle.trim()) return;
    const r = await fetch(`/api/team/projects/${data.project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newSubtaskTitle.trim(),
        type: "subtask",
        parent_id: data.task.id,
        sprint_id: data.task.sprint_id,
      }),
    });
    if (r.ok) {
      setNewSubtaskTitle("");
      setAddingSubtask(false);
      load();
    }
  }

  if (!data) {
    return (
      <TeamShell>
        <p className="text-sm text-slate-400">Loading…</p>
      </TeamShell>
    );
  }

  const { task, project, comments, activities, users, subtasks, sprints, parent } = data;
  const userById = new Map(users.map((u) => [u.id, u]));
  const assignee = task.assignee_id ? userById.get(task.assignee_id) : null;
  const reporter = task.reporter_id ? userById.get(task.reporter_id) : null;
  const sprint = task.sprint_id ? sprints.find((s) => s.id === task.sprint_id) : null;

  const filteredActivity =
    activityTab === "all"
      ? activities
      : activityTab === "comments"
        ? activities.filter((a) => a.action === "commented")
        : activities.filter((a) => a.action !== "commented");

  return (
    <TeamShell>
      <div className="mb-6 flex items-center gap-2 text-sm">
        <a href="/team/projects" className="text-slate-500 hover:text-slate-700">
          Projects
        </a>
        <span className="text-slate-300">/</span>
        <a
          href={`/team/projects/${project.id}/board`}
          className="text-slate-500 hover:text-slate-700"
        >
          {project.key}
        </a>
        {parent && (
          <>
            <span className="text-slate-300">/</span>
            <a
              href={`/team/tasks/${parent.id}`}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
            >
              <TaskTypeIcon type={parent.type} />
              {project.key}-{parent.number}
            </a>
          </>
        )}
        <span className="text-slate-300">/</span>
        <TaskTypeIcon type={task.type} />
        <span className="font-mono text-slate-500">
          {project.key}-{task.number}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {editingTitle && canEdit ? (
            <div className="flex gap-2">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xl font-semibold"
                autoFocus
              />
              <button
                onClick={async () => {
                  await patch({ title: titleDraft });
                  setEditingTitle(false);
                }}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(task.title);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              className={`text-2xl font-bold tracking-tight text-slate-900 ${
                canEdit ? "cursor-pointer hover:bg-slate-50" : ""
              } rounded px-1 -mx-1`}
              onClick={() => canEdit && setEditingTitle(true)}
            >
              {task.title}
            </h1>
          )}

          {/* Description */}
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </h2>
              {canEdit && !editingDesc && (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await patch({ description: descDraft });
                        setEditingDesc(false);
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingDesc(false);
                        setDescDraft(task.description || "");
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : task.description ? (
                <div className="prose prose-sm max-w-none text-slate-700">
                  {renderMarkdown(task.description)}
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">No description.</p>
              )}
            </div>
          </section>

          {/* Subtasks */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subtasks ({subtasks.length})
              </h2>
              {canEdit && !addingSubtask && (
                <button
                  onClick={() => setAddingSubtask(true)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  + Add subtask
                </button>
              )}
            </div>
            <div className="mt-2 space-y-1.5">
              {subtasks.map((s) => {
                const a = userById.get(s.assignee_id ?? -1);
                return (
                  <a
                    key={s.id}
                    href={`/team/tasks/${s.id}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <TaskTypeIcon type={s.type} />
                    <span className="font-mono text-[11px] text-slate-400">
                      {project.key}-{s.number}
                    </span>
                    <span className={`truncate flex-1 ${s.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {s.title}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BG[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                    <Avatar name={a?.name} userId={s.assignee_id} size={5} />
                  </a>
                );
              })}
              {addingSubtask && (
                <div className="flex gap-2">
                  <input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Subtask title…"
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSubtask();
                      if (e.key === "Escape") {
                        setAddingSubtask(false);
                        setNewSubtaskTitle("");
                      }
                    }}
                  />
                  <button
                    onClick={createSubtask}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setAddingSubtask(false);
                      setNewSubtaskTitle("");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {subtasks.length === 0 && !addingSubtask && (
                <p className="text-sm italic text-slate-400">No subtasks.</p>
              )}
            </div>
          </section>

          {/* Activity with tabs */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Activity
              </h2>
              <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                {(["all", "comments", "history"] as ActivityTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActivityTab(t)}
                    className={`rounded-md px-2 py-1 font-medium capitalize ${
                      activityTab === t
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment composer first (like Jira) */}
            {canEdit && activityTab !== "history" && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Write a comment… use @name to mention someone"
                  rows={3}
                  className="w-full resize-none border-0 text-sm focus:outline-none focus:ring-0"
                />
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-[11px] text-slate-400">
                    Markdown: **bold** *italic* `code` [link](url)
                  </span>
                  <button
                    onClick={sendComment}
                    disabled={!commentDraft.trim()}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Comment
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <ol className="mt-3 space-y-2">
              {filteredActivity.length === 0 && (
                <li className="text-sm italic text-slate-400">Nothing yet.</li>
              )}
              {filteredActivity.map((a) => {
                if (a.action === "commented") {
                  const meta = (a.meta || {}) as { comment_id?: number };
                  const c = comments.find((x) => x.id === meta.comment_id);
                  if (!c) return null;
                  const author = userById.get(c.author_id);
                  const mine = me?.user?.id === c.author_id;
                  return (
                    <li
                      key={a.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={author?.name}
                            userId={c.author_id}
                            size={6}
                          />
                          <div className="text-sm">
                            <span className="font-semibold text-slate-900">
                              {author?.name || "Unknown"}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">
                              {new Date(c.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {(mine || me?.user?.role === "admin") && (
                          <div className="flex gap-3 text-xs text-slate-400">
                            {mine && editingCommentId !== c.id && (
                              <button
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditCommentDraft(c.body);
                                }}
                                className="hover:text-slate-800"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => deleteComment(c.id)}
                              className="hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        {editingCommentId === c.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editCommentDraft}
                              onChange={(e) => setEditCommentDraft(e.target.value)}
                              rows={4}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveCommentEdit(c.id)}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          renderMarkdown(c.body)
                        )}
                      </div>
                    </li>
                  );
                }
                const who = a.user_id ? userById.get(a.user_id)?.name : "Someone";
                return (
                  <li
                    key={a.id}
                    className="flex items-baseline gap-2 px-2 text-sm text-slate-600"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full bg-slate-300" />
                    <span>
                      <span className="font-medium text-slate-800">{who}</span>{" "}
                      {describeActivity(a, userById, sprints)}
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <SidebarField label="Status">
            {canEdit ? (
              <select
                value={task.status}
                onChange={(e) => moveStatus(e.target.value as Status)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            ) : (
              <span>{STATUS_LABEL[task.status]}</span>
            )}
          </SidebarField>

          <SidebarField label="Type">
            {canEdit ? (
              <select
                value={task.type}
                onChange={(e) => patch({ type: e.target.value as TaskType })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="task">Task</option>
                <option value="story">Story</option>
                <option value="bug">Bug</option>
                <option value="epic">Epic</option>
                <option value="subtask">Subtask</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <TaskTypeIcon type={task.type} />
                <span>{TASK_TYPE_META[task.type].label}</span>
              </div>
            )}
          </SidebarField>

          <SidebarField label="Priority">
            {canEdit ? (
              <select
                value={task.priority}
                onChange={(e) => patch({ priority: e.target.value as Priority })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm capitalize"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            ) : (
              <span className="capitalize">{task.priority}</span>
            )}
          </SidebarField>

          <SidebarField label="Assignee">
            <div className="flex items-center gap-2">
              {canEdit ? (
                <select
                  value={task.assignee_id ?? ""}
                  onChange={(e) =>
                    patch({ assignee_id: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <Avatar name={assignee?.name} userId={task.assignee_id} size={6} />
                  <span>{assignee?.name || "Unassigned"}</span>
                </>
              )}
            </div>
          </SidebarField>

          <SidebarField label="Reporter">
            {canEdit ? (
              <select
                value={task.reporter_id ?? ""}
                onChange={(e) =>
                  patch({ reporter_id: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">None</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{reporter?.name || "—"}</span>
            )}
          </SidebarField>

          <SidebarField label="Sprint">
            {canEdit ? (
              <select
                value={task.sprint_id ?? ""}
                onChange={(e) =>
                  patch({ sprint_id: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Backlog</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.state}
                  </option>
                ))}
              </select>
            ) : (
              <span>{sprint?.name || "Backlog"}</span>
            )}
          </SidebarField>

          <SidebarField label="Story points">
            {canEdit ? (
              <input
                type="number"
                min={0}
                value={task.story_points ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  patch({ story_points: v });
                }}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <span>{task.story_points ?? "—"}</span>
            )}
          </SidebarField>

          <SidebarField label="Start date">
            {canEdit ? (
              <input
                type="date"
                value={task.start_date || ""}
                onChange={(e) => patch({ start_date: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <span>
                {task.start_date ? new Date(task.start_date).toLocaleDateString() : "—"}
              </span>
            )}
          </SidebarField>

          <SidebarField label="Due date">
            {canEdit ? (
              <input
                type="date"
                value={task.due_date || ""}
                onChange={(e) => patch({ due_date: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <span>
                {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
              </span>
            )}
          </SidebarField>

          <SidebarField label="Labels">
            <div className="flex flex-wrap gap-1">
              {(task.labels || []).map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  {l}
                  {canEdit && (
                    <button
                      onClick={() => removeLabel(l)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`Remove ${l}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {(task.labels || []).length === 0 && (
                <span className="text-xs italic text-slate-400">None</span>
              )}
            </div>
            {canEdit && (
              <div className="mt-2 flex gap-1">
                <input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLabel();
                    }
                  }}
                  placeholder="Add label…"
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                />
                <button
                  onClick={addLabel}
                  className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                >
                  +
                </button>
              </div>
            )}
          </SidebarField>

          <SidebarField label="Created">
            <span className="text-xs text-slate-500">
              {new Date(task.created_at).toLocaleString()}
            </span>
          </SidebarField>
        </aside>
      </div>
    </TeamShell>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function describeActivity(
  a: Activity,
  users: Map<number, PublicUser>,
  sprints: Sprint[],
): string {
  const meta = (a.meta || {}) as Record<string, unknown>;
  switch (a.action) {
    case "created":
      return "created this task";
    case "status_changed":
      return `moved from ${prettyStatus(meta.from)} to ${prettyStatus(meta.to)}`;
    case "priority_changed":
      return `changed priority from ${meta.from} to ${meta.to}`;
    case "type_changed":
      return `changed type from ${meta.from} to ${meta.to}`;
    case "assigned": {
      const toName = typeof meta.to === "number" ? users.get(meta.to)?.name : null;
      return `assigned to ${toName || "someone"}`;
    }
    case "unassigned":
      return "unassigned this task";
    case "reporter_changed": {
      const toName = typeof meta.to === "number" ? users.get(meta.to)?.name : null;
      return `changed reporter to ${toName || "none"}`;
    }
    case "due_date_changed":
      return `changed due date to ${meta.to || "—"}`;
    case "start_date_changed":
      return `changed start date to ${meta.to || "—"}`;
    case "sprint_changed": {
      const toSprint = typeof meta.to === "number" ? sprints.find((s) => s.id === meta.to) : null;
      return `moved to ${toSprint ? toSprint.name : "backlog"}`;
    }
    case "story_points_changed":
      return `set story points to ${meta.to ?? "—"}`;
    case "labels_changed":
      return `updated labels`;
    case "parent_changed":
      return `changed parent`;
    case "title_changed":
      return "renamed this task";
    case "description_changed":
      return "edited the description";
    case "commented":
      return "commented";
    default:
      return a.action;
  }
}

function prettyStatus(v: unknown): string {
  if (v === "todo") return "To Do";
  if (v === "in_progress") return "In Progress";
  if (v === "in_review") return "In Review";
  if (v === "done") return "Done";
  return String(v ?? "");
}
