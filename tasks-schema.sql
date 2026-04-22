-- Internal Task Tracker schema. Run once in Supabase SQL Editor.
-- All tables prefixed with `tt_` to stay isolated from onboarding's `submissions` table.

-- Organizations
create table if not exists public.tt_organizations (
  id          bigserial primary key,
  name        text not null,
  slug        text unique not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Users
create table if not exists public.tt_users (
  id                bigserial primary key,
  organization_id   bigint not null references public.tt_organizations(id) on delete cascade,
  name              text not null,
  email             text unique not null,
  password_hash     text not null,
  role              text not null default 'developer' check (role in ('admin','developer','viewer')),
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);
create index if not exists tt_users_org_idx on public.tt_users(organization_id);

-- Projects
create table if not exists public.tt_projects (
  id                bigserial primary key,
  organization_id   bigint not null references public.tt_organizations(id) on delete cascade,
  key               text not null,
  name              text not null,
  description       text,
  created_by        bigint references public.tt_users(id) on delete set null,
  archived_at       timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,
  unique (organization_id, key)
);
create index if not exists tt_projects_org_idx on public.tt_projects(organization_id);

-- Tasks
create table if not exists public.tt_tasks (
  id            bigserial primary key,
  project_id    bigint not null references public.tt_projects(id) on delete cascade,
  number        int not null,
  title         text not null,
  description   text,
  status        text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority      text not null default 'medium' check (priority in ('low','medium','high')),
  assignee_id   bigint references public.tt_users(id) on delete set null,
  creator_id    bigint not null references public.tt_users(id) on delete restrict,
  due_date      date,
  position      int not null default 0,
  deleted_at    timestamptz,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,
  unique (project_id, number)
);
create index if not exists tt_tasks_status_idx on public.tt_tasks(project_id, status, position);

-- Comments
create table if not exists public.tt_comments (
  id          bigserial primary key,
  task_id     bigint not null references public.tt_tasks(id) on delete cascade,
  author_id   bigint not null references public.tt_users(id) on delete restrict,
  body        text not null,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
create index if not exists tt_comments_task_idx on public.tt_comments(task_id);

-- Activity log
create table if not exists public.tt_activities (
  id          bigserial primary key,
  task_id     bigint not null references public.tt_tasks(id) on delete cascade,
  user_id     bigint references public.tt_users(id) on delete set null,
  action      text not null,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz default now() not null
);
create index if not exists tt_activities_task_idx on public.tt_activities(task_id, created_at desc);

-- Mentions (in-app notifications)
create table if not exists public.tt_mentions (
  id          bigserial primary key,
  comment_id  bigint not null references public.tt_comments(id) on delete cascade,
  user_id     bigint not null references public.tt_users(id) on delete cascade,
  task_id     bigint not null references public.tt_tasks(id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz default now() not null
);
create index if not exists tt_mentions_user_idx on public.tt_mentions(user_id, read_at);

-- Enable RLS on all task-tracker tables but allow all operations via the anon key.
-- Authorization is enforced at the API layer (middleware + user session).
alter table public.tt_organizations enable row level security;
alter table public.tt_users         enable row level security;
alter table public.tt_projects      enable row level security;
alter table public.tt_tasks         enable row level security;
alter table public.tt_comments      enable row level security;
alter table public.tt_activities    enable row level security;
alter table public.tt_mentions      enable row level security;

do $$ begin
  create policy "tt all" on public.tt_organizations for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tt all" on public.tt_users for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tt all" on public.tt_projects for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tt all" on public.tt_tasks for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tt all" on public.tt_comments for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tt all" on public.tt_activities for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "tt all" on public.tt_mentions for all using (true) with check (true);
exception when duplicate_object then null; end $$;
