"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Project, Sprint } from "@/lib/team/types";

const TABS: { key: string; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "backlog", label: "Backlog" },
  { key: "sprints", label: "Sprints" },
  { key: "calendar", label: "Calendar" },
];

export default function ProjectHeader({ id }: { id: string }) {
  const pathname = usePathname();
  const [project, setProject] = useState<Project | null>(null);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);

  useEffect(() => {
    fetch(`/api/team/projects/${id}`)
      .then((r) => r.json())
      .then((d) => setProject(d.project));
    fetch(`/api/team/projects/${id}/sprints`)
      .then((r) => r.json())
      .then((d) => {
        const s = (d.sprints || []) as Sprint[];
        setActiveSprint(s.find((x) => x.state === "active") || null);
      });
  }, [id]);

  const activeTab = TABS.find((t) => pathname?.includes(`/projects/${id}/${t.key}`))?.key;

  return (
    <div className="mb-4">
      <a href="/team/projects" className="text-xs text-slate-500 hover:text-slate-700">
        ← Projects
      </a>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          {project && (
            <>
              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                {project.key}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {project.name}
              </h1>
            </>
          )}
        </div>
        {activeSprint && (
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active: {activeSprint.name}
          </div>
        )}
      </div>
      <nav className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const active = t.key === activeTab;
          return (
            <a
              key={t.key}
              href={`/team/projects/${id}/${t.key}`}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
