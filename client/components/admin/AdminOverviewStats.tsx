import { Users, TrendingUp, DollarSign, AlertCircle, Activity, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { tokenManager } from "@/lib/api";

interface AnalyticsData {
  totalUsers: number;
  activeMiners: number;
  deposits: { last24h: number; last7d: number };
  withdrawals: { last24h: number; last7d: number };
  miningPayouts: { last24h: number; last7d: number };
  referralRewards: number;
  p2p: { activeTrades: number; completedTrades: number; disputedTrades: number };
}

export default function AdminOverviewStats() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">Total Users</p>
            <Users className="text-primary" size={20} />
          </div>
          <p className="text-3xl font-bold">{analytics.totalUsers}</p>
          <p className="text-muted-foreground text-xs mt-2">Active accounts</p>
        </div>

        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">Active Miners</p>
            <TrendingUp className="text-green-500" size={20} />
          </div>
          <p className="text-3xl font-bold">{analytics.activeMiners}</p>
          <p className="text-muted-foreground text-xs mt-2">Active packages</p>
        </div>

        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">Deposits (24h)</p>
            <DollarSign className="text-blue-500" size={20} />
          </div>
          <p className="text-3xl font-bold">{(parseFloat(String(analytics.deposits.last24h)) || 0).toFixed(0)}</p>
          <p className="text-muted-foreground text-xs mt-2">USDT</p>
        </div>

        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">Mining Payouts (24h)</p>
            <Activity className="text-yellow-500" size={20} />
          </div>
          <p className="text-3xl font-bold">{(parseFloat(String(analytics.miningPayouts.last24h)) || 0).toFixed(2)}</p>
          <p className="text-muted-foreground text-xs mt-2">USDT</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">P2P Trades</p>
            <Globe className="text-blue-500" size={20} />
          </div>
          <div className="space-y-2">
            <p className="text-sm">Active: <span className="font-bold text-primary">{analytics.p2p.activeTrades}</span></p>
            <p className="text-sm">Completed: <span className="font-bold text-green-500">{analytics.p2p.completedTrades}</span></p>
            <p className="text-sm">Disputed: <span className="font-bold text-red-500">{analytics.p2p.disputedTrades}</span></p>
          </div>
        </div>

        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">Withdrawals (7d)</p>
            <TrendingUp className="text-green-500" size={20} />
          </div>
          <p className="text-3xl font-bold">{(parseFloat(String(analytics.withdrawals.last7d)) || 0).toFixed(0)}</p>
          <p className="text-muted-foreground text-xs mt-2">Total USDT</p>
        </div>

        <div className="card-gradient border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm font-medium">Referral Rewards</p>
            <AlertCircle className="text-purple-500" size={20} />
          </div>
          <p className="text-3xl font-bold">{(parseFloat(String(analytics.referralRewards)) || 0).toFixed(0)}</p>
          <p className="text-muted-foreground text-xs mt-2">Total USDT</p>
        </div>
      </div>
    </>
  );
}
