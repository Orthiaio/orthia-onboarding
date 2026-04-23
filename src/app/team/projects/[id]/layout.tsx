"use client";

import { use } from "react";
import TeamShell from "../../team-shell";
import ProjectHeader from "./project-header";

export default function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);
  return (
    <TeamShell>
      <ProjectHeader id={id} />
      {children}
    </TeamShell>
  );
}
