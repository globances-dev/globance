import { useState, useEffect } from "react";
import { Search, Filter, ChevronDown, ExternalLink } from "lucide-react";
import { tokenManager, admin } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  network: string;
  address: string;
  status: string;
  created_at: string;
  provider_txid?: string;
  error_message?: string;
  users: {
    email: string;
    full_name: string;
  };
}

export default function WithdrawalMonitoring() {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterNetwork, setFilterNetwork] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      if (!token) return;

      const response = await admin.getWithdrawals(token, {
        email: searchEmail || undefined,
        status: filterStatus || undefined,
        network: filterNetwork || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 100,
      });

      setWithdrawals(response.withdrawals || []);
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
    fetchWithdrawals();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-700";
      case "processing":
        return "bg-blue-500/20 text-blue-700";
      case "pending":
        return "bg-yellow-500/20 text-yellow-700";
      case "failed":
        return "bg-red-500/20 text-red-700";
      default:
        return "bg-gray-500/20 text-gray-700";
    }
  };

  if (selectedWithdrawal) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedWithdrawal(null)}
          className="text-sm text-primary hover:underline mb-4"
        >
          ← Back to Withdrawals
        </button>

        <div className="bg-card border border-border rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Withdrawal Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Withdrawal ID</p>
              <p className="font-mono text-sm break-all">{selectedWithdrawal.id}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">User Email</p>
              <p className="font-semibold">{selectedWithdrawal.users?.email}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">User Name</p>
              <p className="font-semibold">{selectedWithdrawal.users?.full_name}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Withdrawal Amount</p>
              <p className="text-2xl font-bold">${(parseFloat(String(selectedWithdrawal.amount)) || 0).toFixed(2)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Platform Fee</p>
              <p className="font-semibold text-yellow-600">${(parseFloat(String(selectedWithdrawal.fee)) || 0).toFixed(2)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Amount Sent to User</p>
              <p className="font-semibold text-green-600">${(parseFloat(String(selectedWithdrawal.net_amount)) || 0).toFixed(2)} USDT</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Blockchain Network</p>
              <p className="font-semibold text-lg">{selectedWithdrawal.network}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(selectedWithdrawal.status)}`}>
                {selectedWithdrawal.status}
              </span>
            </div>

            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Withdrawal Address</p>
              <p className="font-mono text-sm break-all bg-secondary p-3 rounded mt-1">
                {selectedWithdrawal.address}
              </p>
            </div>

            {selectedWithdrawal.provider_txid && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Transaction Hash / Payout ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-sm break-all bg-secondary p-3 rounded flex-1">
                    {selectedWithdrawal.provider_txid}
                  </p>
                  {selectedWithdrawal.network === "TRC20" && (
                    <a
                      href={`https://tronscan.org/#/transaction/${selectedWithdrawal.provider_txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  {selectedWithdrawal.network === "BEP20" && (
                    <a
                      href={`https://bscscan.com/tx/${selectedWithdrawal.provider_txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {selectedWithdrawal.error_message && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Error Message</p>
                <p className="text-red-600 bg-red-500/10 p-3 rounded mt-1">{selectedWithdrawal.error_message}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Date & Time</p>
              <p className="font-mono text-sm">{formatDate(selectedWithdrawal.created_at)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Withdrawal Monitoring</h2>

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
              <option value="processing">Processing</option>
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

      {/* Withdrawals Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-sm">User Email</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Amount</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Fee</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Network</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Date</th>
                <th className="text-left px-6 py-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Loading withdrawals...
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No withdrawals found
                  </td>
                </tr>
              ) : (
                withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="border-b border-border hover:bg-secondary/50 transition">
                    <td className="px-6 py-4 text-sm">{withdrawal.users?.email}</td>
                    <td className="px-6 py-4 font-semibold text-sm">${(parseFloat(String(withdrawal.amount)) || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-yellow-600">${(parseFloat(String(withdrawal.fee)) || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-mono">{withdrawal.network}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(withdrawal.status)}`}>
                        {withdrawal.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedWithdrawal(withdrawal)}
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
