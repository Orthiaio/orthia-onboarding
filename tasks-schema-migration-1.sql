-- Migration 1: Jira-style features — sprints, subtasks, task types, labels, story points, in_review status.
-- Additive only: safe to run after tasks-schema.sql, never drops existing data.

-- 1. Extend status constraint to include "in_review" as a fourth column.
alter table public.tt_tasks drop constraint if exists tt_tasks_status_check;
alter table public.tt_tasks add constraint tt_tasks_status_check
  check (status in ('todo', 'in_progress', 'in_review', 'done'));

-- 2. Sprints. A project has many sprints; each sprint is planned → active → completed.
create table if not exists public.tt_sprints (
  id            bigserial primary key,
  project_id    bigint not null references public.tt_projects(id) on delete cascade,
  name          text not null,
  goal          text,
  state         text not null default 'planned' check (state in ('planned','active','completed')),
  start_date    date,
  end_date      date,
  started_at    timestamptz,
  completed_at  timestamptz,
  position      int not null default 0,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);
create index if not exists tt_sprints_project_idx on public.tt_sprints(project_id, state);
-- At most one active sprint per project.
create unique index if not exists tt_sprints_one_active
  on public.tt_sprints(project_id) where state = 'active';

alter table public.tt_sprints enable row level security;
do $$ begin
  create policy "tt all" on public.tt_sprints for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 3. Task extensions for Jira parity.
alter table public.tt_tasks
  add column if not exists sprint_id     bigint references public.tt_sprints(id) on delete set null,
  add column if not exists parent_id     bigint references public.tt_tasks(id)   on delete set null,
  add column if not exists reporter_id   bigint references public.tt_users(id)   on delete set null,
  add column if not exists story_points  int,
  add column if not exists start_date    date,
  add column if not exists labels        text[] default '{}',
  add column if not exists type          text not null default 'task';

alter table public.tt_tasks drop constraint if exists tt_tasks_type_check;
alter table public.tt_tasks add constraint tt_tasks_type_check
  check (type in ('task','bug','story','epic','subtask'));

create index if not exists tt_tasks_sprint_idx on public.tt_tasks(sprint_id);
create index if not exists tt_tasks_parent_idx on public.tt_tasks(parent_id);
