-- Migration 6: blocker flag on tasks.
-- Run after migrations 1–5.

alter table public.tt_tasks
  add column if not exists blocked boolean not null default false;
alter table public.tt_tasks
  add column if not exists blocked_reason text;

create index if not exists tt_tasks_blocked_idx
  on public.tt_tasks(project_id, blocked) where blocked = true;
