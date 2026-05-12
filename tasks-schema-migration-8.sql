-- Migration 8: UAT status + sprint retrospectives.
-- Run after migrations 1–7.
--
-- 1. Extend the task status check constraint to include a new "in_uat"
--    state that sits between "in_review" and "done". Existing rows are
--    untouched.
alter table public.tt_tasks drop constraint if exists tt_tasks_status_check;
alter table public.tt_tasks add constraint tt_tasks_status_check
  check (status in ('todo', 'in_progress', 'in_review', 'in_uat', 'done'));

-- 2. Sprint retrospective notes — freeform markdown captured at sprint
--    completion. Nullable so older sprints stay valid.
alter table public.tt_sprints
  add column if not exists retro_notes text;
