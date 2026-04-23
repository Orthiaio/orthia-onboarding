"use client";

import { use, useEffect, useMemo, useState } from "react";
import { PRIORITY_COLORS, STATUS_BG, STATUS_LABEL, TaskTypeIcon } from "@/lib/team/ui";
import type { Priority, Project, Status, Task } from "@/lib/team/types";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    fetch(`/api/team/projects/${id}/tasks`)
      .then((r) => r.json())
      .then((d) => {
        setProject(d.project);
        setTasks(d.tasks || []);
      });
  }, [id]);

  // Build a 6-week grid starting on the Monday on/before the 1st of `cursor`.
  const cells: { date: Date; inMonth: boolean; tasks: Task[] }[] = useMemo(() => {
    const first = startOfMonth(cursor);
    const weekday = (first.getDay() + 6) % 7; // 0 = Monday
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - weekday);

    const byDay = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (!byDay.has(t.due_date)) byDay.set(t.due_date, []);
      byDay.get(t.due_date)!.push(t);
    }

    const out: { date: Date; inMonth: boolean; tasks: Task[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push({
        date: d,
        inMonth: d.getMonth() === cursor.getMonth(),
        tasks: byDay.get(ymd(d)) || [],
      });
    }
    return out;
  }, [cursor, tasks]);

  const today = new Date();

  if (!project) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => (
            <div
              key={i}
              className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${
                c.inMonth ? "bg-white" : "bg-slate-50/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    sameDay(c.date, today)
                      ? "rounded-full bg-slate-900 px-1.5 py-0.5 text-white"
                      : c.inMonth
                        ? "text-slate-700"
                        : "text-slate-300"
                  }`}
                >
                  {c.date.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {c.tasks.slice(0, 3).map((t) => (
                  <a
                    key={t.id}
                    href={`/team/tasks/${t.id}`}
                    className="flex items-center gap-1 truncate rounded bg-slate-50 px-1 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
                  >
                    <TaskTypeIcon type={t.type} />
                    <span
                      className={`rounded px-1 text-[9px] font-semibold uppercase ${
                        PRIORITY_COLORS[t.priority as Priority]
                      }`}
                    >
                      {t.priority[0]}
                    </span>
                    <span
                      className={`rounded px-1 text-[9px] font-semibold ${
                        STATUS_BG[t.status as Status]
                      }`}
                    >
                      {STATUS_LABEL[t.status as Status]}
                    </span>
                    <span className="truncate font-mono text-[9px] text-slate-400">
                      {project.key}-{t.number}
                    </span>
                    <span className="truncate">{t.title}</span>
                  </a>
                ))}
                {c.tasks.length > 3 && (
                  <div className="text-[10px] text-slate-400">
                    +{c.tasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
