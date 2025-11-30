export function initializeScheduler() {
  console.log("[Scheduler] Supabase mode active – internal PG scheduler disabled.");
  return {
    start: () => console.log("[Scheduler] No-op start"),
    stop: () => console.log("[Scheduler] No-op stop"),
  };
}
