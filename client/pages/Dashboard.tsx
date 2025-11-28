import Layout from "@/components/Layout";
import DepositModal from "@/components/DepositModal";
import WithdrawalModal from "@/components/WithdrawalModal";
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager, wallet } from "../lib/api";

interface DepositAddress {
  network: string;
  address: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [balance, setBalance] = useState<number | string>(0);
  const [escrowBalance, setEscrowBalance] = useState<number | string>(0);
  const [totalEarned, setTotalEarned] = useState<number | string>(0);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch user data
      try {
        const userResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserData(userData.user);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        // Continue loading other data
      }

      // Fetch wallet data (balance + total earned)
      try {
        const walletRes = await wallet.getMe(token);
        setBalance(parseFloat(walletRes.usdt_balance || 0) || 0);
        setEscrowBalance(parseFloat(walletRes.escrow_balance || 0) || 0);
        setTotalEarned(parseFloat(walletRes.total_earned || 0) || 0);
      } catch (err) {
        console.error("Error fetching wallet data:", err);
        setBalance(0);
        setEscrowBalance(0);
        setTotalEarned(0);
        toast({
          title: "Error",
          description: "Failed to load wallet data",
          variant: "destructive",
        });
      }

      // Fetch deposit addresses
      try {
        const addressesRes = await wallet.getDepositAddresses(token);
        setAddresses(addressesRes.addresses || []);
      } catch (err) {
        console.error("Error fetching deposit addresses:", err);
        setAddresses([]);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    }
  };

  const handleDepositClick = () => {
    setDepositModalOpen(true);
  };

  const handleWithdrawalClick = () => {
    setWithdrawalModalOpen(true);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Your Mining Power Is Working For You</h1>
          <p className="text-muted-foreground">
            Track your mining performance and earnings in real-time
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card-gradient border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-muted-foreground text-sm font-medium">
                Total Balance
              </p>
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <span className="text-primary">$</span>
              </div>
            </div>
            <p className="text-3xl font-bold">
              {loading ? "..." : `$${(typeof balance === 'number' ? balance : parseFloat(balance || 0) || 0).toFixed(2)}`}
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              USDT (TRC20 + BEP20)
            </p>
          </div>

          <div className="card-gradient border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-muted-foreground text-sm font-medium">
                Total Earnings
              </p>
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-accent" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold">
              {loading ? "..." : `$${(typeof totalEarned === 'number' ? totalEarned : parseFloat(totalEarned || 0) || 0).toFixed(2)}`}
            </p>
            <p className="text-muted-foreground text-xs mt-2">
              Lifetime earnings
            </p>
          </div>

          <div className="card-gradient border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-muted-foreground text-sm font-medium">
                Active Packages
              </p>
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <span className="text-primary font-bold">0</span>
              </div>
            </div>
            <p className="text-3xl font-bold">0</p>
            <p className="text-muted-foreground text-xs mt-2">
              Mining in progress
            </p>
          </div>

          <div className="card-gradient border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-muted-foreground text-sm font-medium">
                Referral Count
              </p>
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Users className="text-primary" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold">0</p>
            <p className="text-muted-foreground text-xs mt-2">Users referred</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleDepositClick}
              className="bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowDownLeft size={20} />
              Deposit USDT
            </button>
            <button
              onClick={handleWithdrawalClick}
              className="bg-secondary text-foreground font-semibold py-3 px-6 rounded-lg hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowUpRight size={20} />
              Withdraw Earnings
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
          <div className="card-gradient border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">No recent transactions yet</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal
        open={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        addresses={addresses}
      />
      <WithdrawalModal
        open={withdrawalModalOpen}
        onClose={() => setWithdrawalModalOpen(false)}
        balance={balance}
        onSuccess={fetchDashboardData}
      />
    </Layout>
  );
}
