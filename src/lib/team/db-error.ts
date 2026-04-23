/**
 * Map a raw Supabase / PostgREST error into a human-actionable message.
 * The most common post-migration failure mode is a stale schema cache —
 * the table exists in Postgres but PostgREST hasn't reloaded yet. Surface
 * the fix (run the migration, or run `notify pgrst, 'reload schema'`)
 * instead of the bare error.
 */
export function describeDbError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "Unknown database error";
  const msg = err.message || "Database error";
  if (err.code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return `${msg} — run tasks-schema-migration-1.sql in Supabase, then retry.`;
  }
  if (/schema cache/i.test(msg)) {
    return `${msg} — migration hasn't been applied (or PostgREST hasn't reloaded). Run tasks-schema-migration-1.sql in Supabase SQL editor, then retry.`;
  }
  return msg;
}
