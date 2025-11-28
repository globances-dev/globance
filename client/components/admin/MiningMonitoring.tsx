import { useState, useEffect } from "react";
import { Search, Filter, ChevronDown } from "lucide-react";
import { tokenManager, admin } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface MiningPurchase {
  id: string;
  user_id: string;
  package_id: string;
  amount: number;
  status: string;
  start_time: string;
  last_reward_time: string;
  end_time: string;
  total_earned: number;
  users: {
    email: string;
    full_name: string;
  };
  packages: {
    name: string;
    daily_percent: number;
    duration_days: number;
  };
}

export default function MiningMonitoring() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<MiningPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterPackage, setFilterPackage] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<MiningPurchase | null>(null);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      if (!token) return;

      const response = await admin.getMiningPurchases(token, {
        email: searchEmail || undefined,
        package_id: filterPackage || undefined,
        status: filterStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 100,
      });

      setPurchases(response.purchases || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchPurchases();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getDaysRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = new Date().getTime();
    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-700";
      case "expired":
        return "bg-red-500/20 text-red-700";
      case "pending":
        return "bg-yellow-500/20 text-yellow-700";
      default:
        return "bg-gray-500/20 text-gray-700";
    }
  };

  if (selectedPurchase) {
    const daysRemaining = getDaysRemaining(selectedPurchase.end_time);
    const dailyEarning = (selectedPurchase.amount * selectedPurchase.packages.daily_percent) / 100;

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedPurchase(null)}
          className="text-sm text-primary hover:underline mb-4"
        >
          ← Back to Mining Purchases
        </button>

        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Mining Purchase Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Purchase ID</p>
              <p className="font-mono text-sm break-all">{selectedPurchase.id}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">User Email</p>
              <p className="font-semibold">{selectedPurchase.users?.email}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">User Name</p>
              <p className="font-semibold">{selectedPurchase.users?.full_name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Mining Package</p>
              <p className="font-semibold">{selectedPurchase.packages?.name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Investment Amount</p>
              <p className="text-2xl font-bold">${(parseFloat(String(selectedPurchase.amount)) || 0).toFixed(2)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Daily Rate</p>
              <p className="font-semibold text-lg">{selectedPurchase.packages?.daily_percent}%</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Estimated Daily Earning</p>
              <p className="font-semibold text-green-600">${(parseFloat(String(dailyEarning)) || 0).toFixed(2)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(selectedPurchase.status)}`}>
                {selectedPurchase.status}
              </span>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Total Package Duration</p>
              <p className="font-semibold">{selectedPurchase.packages?.duration_days} days</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Days Remaining</p>
              <p className={`font-semibold ${daysRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {daysRemaining} days
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Total Earned from Package</p>
              <p className="font-bold text-primary">${(parseFloat(String(selectedPurchase.total_earned)) || 0).toFixed(2)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">ROI %</p>
              <p className="font-semibold">
                {(((parseFloat(String(selectedPurchase.total_earned)) || 0) / (parseFloat(String(selectedPurchase.amount)) || 1)) * 100).toFixed(2)}%
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-mono text-sm">{formatDate(selectedPurchase.start_time)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Expiry Date</p>
              <p className="font-mono text-sm">{formatDate(selectedPurchase.end_time)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Last Payout Date</p>
              <p className="font-mono text-sm">{formatDate(selectedPurchase.last_reward_time)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Mining Monitoring</h2>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Filter size={18} />
          Search & Filter
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Package</label>
            <select
              value={filterPackage}
              onChange={(e) => setFilterPackage(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Packages</option>
              <option value="bronze">Bronze (2.5%)</option>
              <option value="silver">Silver (2.6%)</option>
              <option value="gold">Gold (2.7%)</option>
              <option value="platinum">Platinum (2.8%)</option>
              <option value="diamond">Diamond (2.9%)</option>
              <option value="legendary">Legendary (3.0%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Mining Purchases Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-sm">User Email</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Package</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Amount</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Daily %</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Total Earned</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Days Left</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    Loading mining purchases...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No mining purchases found
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-border hover:bg-secondary/50 transition">
                    <td className="px-6 py-4 text-sm">{purchase.users?.email}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{purchase.packages?.name}</td>
                    <td className="px-6 py-4 font-semibold text-sm">${(parseFloat(String(purchase.amount)) || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-accent">{purchase.packages?.daily_percent}%</td>
                    <td className="px-6 py-4 font-semibold text-sm text-green-600">${(parseFloat(String(purchase.total_earned)) || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(purchase.status)}`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      {getDaysRemaining(purchase.end_time)} days
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedPurchase(purchase)}
                        className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                      >
                        View <ChevronDown size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
