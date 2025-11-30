export function initializeP2PCron() {
  console.log("[P2P Cron] Supabase mode active – PostgreSQL cron jobs disabled.");
  return {
    start: () => console.log("[P2P Cron] No-op start"),
    stop: () => console.log("[P2P Cron] No-op stop"),
  };
}
