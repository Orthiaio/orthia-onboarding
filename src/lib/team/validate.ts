import { teamDb } from "./supabase";

/**
 * Verify a sprint id belongs to the given project. Returns true if the sprint
 * exists and is in-project. Used before accepting `sprint_id` from a client
 * to block cross-org/cross-project pointer attacks.
 */
export async function sprintInProject(
  sprintId: number | null,
  projectId: number,
): Promise<boolean> {
  if (sprintId === null) return true;
  const { data } = await teamDb
    .from("tt_sprints")
    .select("project_id")
    .eq("id", sprintId)
    .maybeSingle();
  return (data as { project_id: number } | null)?.project_id === projectId;
}

/**
 * Verify a task id belongs to the given project (used for parent_id).
 */
export async function taskInProject(
  taskId: number | null,
  projectId: number,
): Promise<boolean> {
  if (taskId === null) return true;
  const { data } = await teamDb
    .from("tt_tasks")
    .select("project_id,deleted_at")
    .eq("id", taskId)
    .maybeSingle();
  const t = data as { project_id: number; deleted_at: string | null } | null;
  return t != null && t.project_id === projectId && t.deleted_at === null;
}

/**
 * Verify a user id belongs to the given organization. Used for assignee_id /
 * reporter_id before accepting client input.
 */
export async function userInOrg(
  userId: number | null,
  orgId: number,
): Promise<boolean> {
  if (userId === null) return true;
  const { data } = await teamDb
    .from("tt_users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return (data as { organization_id: number } | null)?.organization_id === orgId;
}
