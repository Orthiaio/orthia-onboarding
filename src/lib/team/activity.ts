import { teamDb } from "./supabase";
import type { Activity } from "./types";

export async function logActivity(
  task_id: number,
  user_id: number | null,
  action: Activity["action"],
  meta: Record<string, unknown> = {},
) {
  await teamDb.from("tt_activities").insert({ task_id, user_id, action, meta });
}
