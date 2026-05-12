import React from "react";
import type { Priority, Status, TaskType } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  in_uat: "UAT",
  done: "Done",
};

export const STATUS_ACCENT: Record<Status, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-amber-500",
  in_uat: "bg-violet-500",
  done: "bg-emerald-500",
};

export const STATUS_BG: Record<Status, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  in_uat: "bg-violet-100 text-violet-700",
  done: "bg-emerald-100 text-emerald-700",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export const TASK_TYPE_META: Record<
  TaskType,
  { label: string; icon: string; color: string; bg: string }
> = {
  task: { label: "Task", icon: "▣", color: "text-blue-600", bg: "bg-blue-50" },
  story: { label: "Story", icon: "●", color: "text-emerald-600", bg: "bg-emerald-50" },
  bug: { label: "Bug", icon: "●", color: "text-red-600", bg: "bg-red-50" },
  epic: { label: "Epic", icon: "⬢", color: "text-purple-600", bg: "bg-purple-50" },
  subtask: { label: "Subtask", icon: "⇣", color: "text-slate-500", bg: "bg-slate-50" },
};

// Deterministic avatar color from a user id.
const AVATAR_PALETTE = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-cyan-500",
  "bg-lime-600",
  "bg-teal-500",
  "bg-orange-500",
];

export function avatarColor(id: number | null | undefined): string {
  if (id == null) return "bg-slate-300";
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

export function Avatar({
  name,
  userId,
  size = 6,
  className = "",
}: {
  name: string | null | undefined;
  userId: number | null | undefined;
  size?: 5 | 6 | 7 | 8 | 10;
  className?: string;
}) {
  const px = { 5: "h-5 w-5", 6: "h-6 w-6", 7: "h-7 w-7", 8: "h-8 w-8", 10: "h-10 w-10" }[size];
  const text = { 5: "text-[9px]", 6: "text-[10px]", 7: "text-[11px]", 8: "text-xs", 10: "text-sm" }[size];
  if (!name || userId == null) {
    return (
      <span
        className={`inline-flex ${px} items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-500 ${text} ${className}`}
        title="Unassigned"
      >
        ?
      </span>
    );
  }
  return (
    <span
      title={name}
      className={`inline-flex ${px} items-center justify-center rounded-full text-white font-semibold ${text} ${avatarColor(userId)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function TaskTypeIcon({ type, className = "" }: { type: TaskType; className?: string }) {
  const meta = TASK_TYPE_META[type];
  return (
    <span
      title={meta.label}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[11px] font-bold ${meta.color} ${meta.bg} ${className}`}
    >
      {meta.icon}
    </span>
  );
}

export function LabelChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
      {label}
    </span>
  );
}
