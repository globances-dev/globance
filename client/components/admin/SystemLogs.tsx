import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { tokenManager } from "@/lib/api";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  description: string;
  created_at: string;
}

export default function SystemLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) return;

      const response = await fetch("/api/admin/audit-logs?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading system logs...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">System Logs</h2>
        <p className="text-muted-foreground mb-6">View audit logs and system activities</p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No logs available</div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="hover:bg-secondary/50 transition-colors">
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{log.action}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${expandedLog === log.id ? "rotate-180" : ""}`}
                  />
                </button>
                {expandedLog === log.id && (
                  <div className="px-6 py-4 bg-secondary/50 text-sm space-y-2">
                    <div>
                      <span className="text-muted-foreground">User ID:</span>
                      <span className="ml-2 font-mono text-xs">{log.user_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <div className="mt-1 p-2 bg-background rounded text-xs">{log.description}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={fetchLogs}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
      >
        Refresh Logs
      </button>
    </div>
  );
}
