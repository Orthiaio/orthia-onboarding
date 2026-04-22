"use client";

import { use, useEffect, useState } from "react";
import TeamShell, { useMe } from "../../team-shell";
import { renderMarkdown } from "@/lib/team/markdown";
import type {
  Activity,
  Comment,
  Priority,
  PublicUser,
  Status,
  Task,
} from "@/lib/team/types";

interface DetailResponse {
  task: Task;
  project: { id: number; key: string; organization_id: number };
  comments: Comment[];
  activities: Activity[];
  users: PublicUser[];
}

const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

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
    setCommentDraft("");
    await fetch(`/api/team/tasks/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
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

  if (!data) {
    return (
      <TeamShell>
        <p className="text-sm text-slate-400">Loading…</p>
      </TeamShell>
    );
  }

  const { task, project, comments, activities, users } = data;
  const userById = new Map(users.map((u) => [u.id, u]));
  const assignee = task.assignee_id ? userById.get(task.assignee_id) : null;

  return (
    <TeamShell>
      <div className="mb-6 flex items-center gap-3 text-sm">
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
        <span className="text-slate-300">/</span>
        <span className="font-mono text-slate-500">
          {project.key}-{task.number}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
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

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comments ({comments.length})
            </h2>
            <div className="mt-3 space-y-3">
              {comments.map((c) => {
                const author = userById.get(c.author_id);
                const mine = me?.user?.id === c.author_id;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-semibold text-slate-900">
                          {author?.name || "Unknown"}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
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
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className="text-sm italic text-slate-400">No comments yet.</p>
              )}
            </div>
            {canEdit && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
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
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Activity
            </h2>
            <ol className="mt-3 space-y-1.5">
              {activities.map((a) => {
                const who = a.user_id ? userById.get(a.user_id)?.name : "Someone";
                return (
                  <li
                    key={a.id}
                    className="flex items-baseline gap-2 text-sm text-slate-600"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full bg-slate-300" />
                    <span>
                      <span className="font-medium text-slate-800">{who}</span>{" "}
                      {describeActivity(a, userById)}
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </span>
                  </li>
                );
              })}
              {activities.length === 0 && (
                <li className="text-sm italic text-slate-400">No activity.</li>
              )}
            </ol>
          </section>
        </div>

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
                <option value="done">Done</option>
              </select>
            ) : (
              <span>{STATUS_LABEL[task.status]}</span>
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
              <span>{assignee?.name || "Unassigned"}</span>
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

function describeActivity(a: Activity, users: Map<number, PublicUser>): string {
  const meta = (a.meta || {}) as Record<string, unknown>;
  switch (a.action) {
    case "created":
      return "created this task";
    case "status_changed":
      return `moved from ${prettyStatus(meta.from)} to ${prettyStatus(meta.to)}`;
    case "priority_changed":
      return `changed priority from ${meta.from} to ${meta.to}`;
    case "assigned": {
      const toName = typeof meta.to === "number" ? users.get(meta.to)?.name : null;
      return `assigned to ${toName || "someone"}`;
    }
    case "unassigned":
      return "unassigned this task";
    case "due_date_changed":
      return `changed due date to ${meta.to || "—"}`;
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
  if (v === "done") return "Done";
  return String(v ?? "");
}
