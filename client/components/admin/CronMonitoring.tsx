import { Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { tokenManager } from "@/lib/api";

interface CronStatus {
  lastMiningCron: {
    timestamp: string;
    processed: number;
    distributed: number;
    p2pExpired: number;
    status: string;
  };
  recentLogs: any[];
}

export default function CronMonitoring() {
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCronStatus();
    const interval = setInterval(fetchCronStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchCronStatus = async () => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch("/api/admin/cron-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCronStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch cron status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !cronStatus) {
    return <div className="text-center py-12">Loading cron status...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Cron Job Monitoring</h2>
        <p className="text-muted-foreground">Monitor automated system operations</p>
      </div>

      {/* Last Mining Cron */}
      <div className="card-gradient border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Daily Mining Payouts (21:00 UTC)</h3>
            <p className="text-sm text-muted-foreground">Distributes daily earnings and referral rewards</p>
          </div>
          {cronStatus.lastMiningCron.status === "success" ? (
            <CheckCircle className="text-green-500" size={24} />
          ) : (
            <AlertCircle className="text-yellow-500" size={24} />
          )}
        </div>

        {cronStatus.lastMiningCron.timestamp ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Last Run</p>
              <p className="text-sm font-mono">
                {new Date(cronStatus.lastMiningCron.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="bg-background/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Purchases Processed</p>
              <p className="text-2xl font-bold">{cronStatus.lastMiningCron.processed}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Distributed</p>
              <p className="text-2xl font-bold">{(parseFloat(String(cronStatus.lastMiningCron.distributed)) || 0).toFixed(2)} USDT</p>
            </div>
            <div className="bg-background/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">P2P Trades Expired</p>
              <p className="text-2xl font-bold">{cronStatus.lastMiningCron.p2pExpired}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No runs yet</p>
        )}
      </div>

      {/* Recent Cron Logs */}
      <div className="card-gradient border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Cron Logs</h3>

        {cronStatus.recentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent logs</p>
        ) : (
          <div className="space-y-3">
            {cronStatus.recentLogs.map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">{log.process_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{log.purchases_processed || 0} processed</p>
                  <p className="text-xs text-muted-foreground">{(log.total_distributed || 0).toFixed(2)} USDT</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Schedule */}
      <div className="card-gradient border border-border rounded-lg p-6 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-500" size={24} />
          <div>
            <p className="text-sm font-medium">Next Scheduled Run</p>
            <p className="text-xs text-muted-foreground">
              Daily at 21:00 UTC (9:00 PM UTC)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
