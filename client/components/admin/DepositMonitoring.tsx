import { useState, useEffect } from "react";
import { Search, Filter, ChevronDown, ExternalLink } from "lucide-react";
import { tokenManager, admin } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  network: string;
  txid: string;
  status: string;
  created_at: string;
  provider: string;
  users: {
    email: string;
    full_name: string;
  };
  deposit_addresses: {
    address: string;
  }[];
}

export default function DepositMonitoring() {
  const { toast } = useToast();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterNetwork, setFilterNetwork] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      if (!token) return;

      const response = await admin.getDeposits(token, {
        email: searchEmail || undefined,
        status: filterStatus || undefined,
        network: filterNetwork || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 100,
      });

      setDeposits(response.deposits || []);
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
    fetchDeposits();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-700";
      case "pending":
        return "bg-yellow-500/20 text-yellow-700";
      case "failed":
        return "bg-red-500/20 text-red-700";
      default:
        return "bg-gray-500/20 text-gray-700";
    }
  };

  if (selectedDeposit) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedDeposit(null)}
          className="text-sm text-primary hover:underline mb-4"
        >
          ← Back to Deposits
        </button>

        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Deposit Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Deposit ID</p>
              <p className="font-mono text-sm break-all">{selectedDeposit.id}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">User Email</p>
              <p className="font-semibold">{selectedDeposit.users?.email}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">User Name</p>
              <p className="font-semibold">{selectedDeposit.users?.full_name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-2xl font-bold">${(parseFloat(String(selectedDeposit.amount)) || 0).toFixed(8)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Blockchain Network</p>
              <p className="font-semibold text-lg">{selectedDeposit.network}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(selectedDeposit.status)}`}>
                {selectedDeposit.status}
              </span>
            </div>

            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Deposit Address</p>
              <p className="font-mono text-sm break-all bg-secondary p-3 rounded mt-1">
                {selectedDeposit.deposit_addresses?.[0]?.address || "N/A"}
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Transaction Hash</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-sm break-all bg-secondary p-3 rounded flex-1">
                  {selectedDeposit.txid || "N/A"}
                </p>
                {selectedDeposit.txid && (
                  <a
                    href={`https://tronscan.org/#/transaction/${selectedDeposit.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Provider</p>
              <p className="font-semibold capitalize">{selectedDeposit.provider}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Date & Time</p>
              <p className="font-mono text-sm">{formatDate(selectedDeposit.created_at)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Deposit Monitoring</h2>

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
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Network</label>
            <select
              value={filterNetwork}
              onChange={(e) => setFilterNetwork(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Networks</option>
              <option value="TRC20">TRC20 (TRON)</option>
              <option value="BEP20">BEP20 (BSC)</option>
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

      {/* Deposits Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-sm">User Email</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Amount</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Network</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Date</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Loading deposits...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No deposits found
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr key={deposit.id} className="border-b border-border hover:bg-secondary/50 transition">
                    <td className="px-6 py-4 text-sm">{deposit.users?.email}</td>
                    <td className="px-6 py-4 font-semibold text-sm">${(parseFloat(String(deposit.amount)) || 0).toFixed(8)}</td>
                    <td className="px-6 py-4 text-sm font-mono">{deposit.network}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(deposit.status)}`}>
                        {deposit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(deposit.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedDeposit(deposit)}
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
