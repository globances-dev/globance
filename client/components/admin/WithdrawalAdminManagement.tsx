import { useState, useEffect } from "react";
import { Search, Filter, CheckCircle, XCircle } from "lucide-react";
import { tokenManager } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Withdrawal {
  id: string;
  user_id: string;
  amount_usdt: number;
  fee_usdt: number;
  net_amount_usdt: number;
  address: string;
  network: string;
  status: string;
  created_at: string;
  updated_at: string;
  users?: { email: string; full_name: string };
}

// Format date to "Nov 25, 2025, 2:30 AM" format
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function WithdrawalAdminManagement() {
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [networkFilter, setNetworkFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    fetchWithdrawals();
  }, [statusFilter, networkFilter]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (networkFilter) params.append("network", networkFilter);

      const response = await fetch(`/api/admin/withdrawals?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
      toast({
        title: "Error",
        description: "Failed to load withdrawals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (withdrawalId: string) => {
    try {
      setActioningId(withdrawalId);
      const token = tokenManager.getToken();

      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}/complete`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Withdrawal marked as completed",
      });

      fetchWithdrawals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (withdrawalId: string) => {
    try {
      setActioningId(withdrawalId);
      const token = tokenManager.getToken();

      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}/reject`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason: "Rejected by admin" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Withdrawal rejected and refunded to user",
      });

      fetchWithdrawals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActioningId(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) =>
    w.users?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Manual Withdrawal Management</h2>
        <p className="text-muted-foreground">Approve or reject user withdrawal requests</p>
      </div>

      {/* Filters */}
      <div className="card-gradient border border-border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Search by Email or Address</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Email or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Network</label>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="">All Networks</option>
              <option value="TRC20">TRC20</option>
              <option value="BEP20">BEP20</option>
            </select>
          </div>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="card-gradient border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading withdrawals...</div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No withdrawals found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-background/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Fee</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Net</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Network</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Address</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Requested</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Completed</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium">{w.users?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{w.users?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">{(parseFloat(String(w.amount_usdt)) || 0).toFixed(2)} USDT</td>
                    <td className="px-6 py-4 text-sm text-yellow-600">{(parseFloat(String(w.fee_usdt)) || 0).toFixed(2)} USDT</td>
                    <td className="px-6 py-4 text-sm text-green-600">{(parseFloat(String(w.net_amount_usdt)) || 0).toFixed(2)} USDT</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium">
                        {w.network}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-xs">
                      <div className="max-w-xs truncate" title={w.address}>
                        {w.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDateTime(w.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {w.status === "completed" || w.status === "rejected" 
                        ? formatDateTime(w.updated_at) 
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          w.status === "completed"
                            ? "bg-green-500/20 text-green-500"
                            : w.status === "rejected"
                            ? "bg-red-500/20 text-red-500"
                            : w.status === "pending"
                            ? "bg-yellow-500/20 text-yellow-500"
                            : "bg-gray-500/20 text-gray-500"
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      {w.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleComplete(w.id)}
                            disabled={actioningId !== null}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-500 hover:bg-green-500/30 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <CheckCircle size={14} />
                            Complete
                          </button>
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={actioningId !== null}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
