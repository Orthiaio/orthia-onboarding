"use client";

import { use, useEffect } from "react";

export default function ProjectIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  useEffect(() => {
    window.location.replace(`/team/projects/${id}/board`);
  }, [id]);
  return <p className="text-sm text-slate-400">Loading…</p>;
}
