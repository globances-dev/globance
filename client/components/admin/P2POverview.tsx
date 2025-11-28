import { useState, useEffect } from "react";
import { useToast } from "../../hooks/use-toast";
import { tokenManager } from "../../lib/api";
import { TrendingUp, ShoppingBag, AlertCircle, DollarSign, Activity, Users } from "lucide-react";

interface P2PStats {
  activeOffers: number;
  todayTrades: number;
  weekTrades: number;
  openDisputes: number;
  weekVolume: number;
  totalUsers: number;
}

export default function P2POverview() {
  const { toast } = useToast();
  const [stats, setStats] = useState<P2PStats>({
    activeOffers: 0,
    todayTrades: 0,
    weekTrades: 0,
    openDisputes: 0,
    weekVolume: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();

      // Fetch marketplace-wide stats from admin API
      const response = await fetch("/api/p2p/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          activeOffers: data.activeOffers || 0,
          todayTrades: data.todayTrades || 0,
          weekTrades: data.weekTrades || 0,
          openDisputes: data.openDisputes || 0,
          weekVolume: data.weekVolume || 0,
          totalUsers: data.totalUsers || 0,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load P2P stats",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load P2P stats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Active Offers",
      value: stats.activeOffers,
      icon: ShoppingBag,
      color: "text-primary",
      bgColor: "bg-primary/20",
      description: "Available for trading",
    },
    {
      title: "Trades Today",
      value: stats.todayTrades,
      icon: Activity,
      color: "text-accent",
      bgColor: "bg-accent/20",
      description: "Completed today",
    },
    {
      title: "Trades (7 Days)",
      value: stats.weekTrades,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/20",
      description: "Last 7 days",
    },
    {
      title: "Open Disputes",
      value: stats.openDisputes,
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/20",
      description: "Needs attention",
    },
    {
      title: "Volume (7 Days)",
      value: `${(parseFloat(String(stats.weekVolume)) || 0).toFixed(2)} USDT`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/20",
      description: "Total traded",
    },
    {
      title: "Active Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/20",
      description: "Trading participants",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">P2P Overview</h2>
        <p className="text-muted-foreground text-sm">
          Monitor P2P marketplace performance
        </p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Loading P2P statistics...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {statCards.map((stat, index) => (
              <div
                key={index}
                className="card-gradient border border-border rounded-lg p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-muted-foreground text-sm font-medium">
                    {stat.title}
                  </p>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={stat.color} size={20} />
                  </div>
                </div>
                <p className="text-3xl font-bold mb-1">
                  {typeof stat.value === "number" ? stat.value : stat.value}
                </p>
                <p className="text-muted-foreground text-xs">{stat.description}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card-gradient border border-border rounded-lg p-6">
            <h3 className="font-bold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => window.location.href = "#fiat"}
                className="p-4 bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors text-left"
              >
                <ShoppingBag className="text-primary mb-2" size={24} />
                <p className="font-medium">Manage Currencies</p>
                <p className="text-xs text-muted-foreground">
                  Add or edit fiat currencies
                </p>
              </button>
              <button
                onClick={() => window.location.href = "#disputes"}
                className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-colors text-left"
              >
                <AlertCircle className="text-destructive mb-2" size={24} />
                <p className="font-medium">Review Disputes</p>
                <p className="text-xs text-muted-foreground">
                  {stats.openDisputes > 0
                    ? `${stats.openDisputes} disputes waiting`
                    : "No pending disputes"}
                </p>
              </button>
              <button
                onClick={fetchStats}
                className="p-4 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors text-left"
              >
                <Activity className="text-accent mb-2" size={24} />
                <p className="font-medium">Refresh Stats</p>
                <p className="text-xs text-muted-foreground">
                  Update all statistics
                </p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
