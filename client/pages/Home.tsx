import Layout from "@/components/Layout";
import { ArrowDownLeft, TrendingUp, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager, wallet, activity } from "../lib/api";
import { useNavigate } from "react-router-dom";
import DepositModal from "@/components/DepositModal";

interface DepositAddress {
  network: string;
  address: string;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  amount?: number;
  status?: string;
  timestamp: string;
}

export default function Home() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [activePackages, setActivePackages] = useState(0);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch wallet data
      const walletRes = await wallet.getMe(token);
      setBalance(parseFloat(walletRes.usdt_balance || 0) || 0);
      setTotalEarned(parseFloat(walletRes.total_earned || 0) || 0);

      // Fetch deposit addresses
      const addressesRes = await wallet.getDepositAddresses(token);
      setAddresses(addressesRes.addresses || []);

      // Fetch active packages
      const packagesRes = await fetch("/api/mining/my-packages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const packagesData = await packagesRes.json();
      if (packagesRes.ok) {
        setActivePackages(packagesData.packages?.length || 0);
      }

      // Fetch today's earnings from backend
      const earningsRes = await activity.getTodayEarnings(token);
      setTodayEarnings(parseFloat(earningsRes.total_today || 0) || 0);

      // Fetch recent activity feed
      const feedRes = await activity.getFeed(token);
      setRecentActivities((feedRes.activities || []).slice(0, 5));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Earn Daily With Automated Cloud Mining</h1>
          <p className="text-sm text-[#9CA3AF]">Your mining power is working 24/7</p>
        </div>

        {/* Balance Card - Premium Dark Gradient */}
        <div className="relative overflow-hidden rounded-xl p-5" style={{
          background: 'linear-gradient(135deg, #181A20 0%, #0F1115 100%)',
          boxShadow: '0 0 40px rgba(240, 185, 11, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#F0B90B]/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-[#A7B0BB] uppercase tracking-wide mb-1">Total Balance</p>
            <h2 className="text-3xl font-bold mb-4">
              ${(typeof balance === 'number' ? balance : parseFloat(balance || 0) || 0).toFixed(2)} <span className="text-base text-[#6F7680]">USDT</span>
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDepositModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-all text-sm"
                style={{
                  background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                  color: '#FFFFFF'
                }}
              >
                <ArrowDownLeft size={16} />
                Deposit
              </button>
              <button
                onClick={() => navigate("/mining")}
                className="flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-lg transition-all text-sm hover:brightness-95 active:brightness-90"
                style={{
                  background: '#F0B90B',
                  color: '#000000',
                  boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
                }}
              >
                <Zap size={16} />
                Buy Power
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(39, 196, 107, 0.15)' }}>
                <TrendingUp className="text-[#27C46B]" size={14} />
              </div>
              <p className="text-xs text-[#6B7280]">Today</p>
            </div>
            <p className="text-xl font-bold text-[#27C46B]">+${(typeof todayEarnings === 'number' ? todayEarnings : parseFloat(todayEarnings || 0) || 0).toFixed(2)}</p>
          </div>

          <div className="rounded-xl p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(240, 185, 11, 0.15)' }}>
                <TrendingUp className="text-[#F0B90B]" size={14} />
              </div>
              <p className="text-xs text-[#6B7280]">Total Earned</p>
            </div>
            <p className="text-xl font-bold text-white">${(typeof totalEarned === 'number' ? totalEarned : parseFloat(totalEarned || 0) || 0).toFixed(2)}</p>
          </div>

          <div className="col-span-2 rounded-xl p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-[#9CA3AF]">Active Mining Packages</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                <Zap className="text-[#3B82F6]" size={14} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{activePackages}</p>
            <button
              onClick={() => navigate("/mining")}
              className="mt-2 text-sm text-[#F0B90B] hover:underline"
            >
              View all packages →
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl p-4" style={{ background: '#181A20' }}>
          <h3 className="font-semibold mb-3 text-white text-sm">Recent Activity</h3>
          <div className="space-y-2">
            {recentActivities.length === 0 ? (
              <div className="text-center py-6 rounded-lg" style={{ background: '#1E2126' }}>
                <p className="text-[#9CA3AF] text-sm mb-2">No activity yet</p>
                <button
                  onClick={() => navigate("/mining")}
                  className="text-sm text-[#F0B90B] hover:underline"
                >
                  Buy your first package →
                </button>
              </div>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: '#1E2126' }}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: act.type === 'mining' ? 'rgba(39, 196, 107, 0.15)' :
                          act.type === 'deposit' ? 'rgba(59, 130, 246, 0.15)' :
                          act.type === 'withdrawal' ? 'rgba(255, 165, 0, 0.15)' :
                          act.type === 'package' ? 'rgba(240, 185, 11, 0.15)' :
                          'rgba(147, 51, 234, 0.15)'
                      }}
                    >
                      <span className="text-base">
                        {act.type === 'mining' ? '⛏️' :
                         act.type === 'deposit' ? '📥' :
                         act.type === 'withdrawal' ? '📤' :
                         act.type === 'package' ? '📦' :
                         '👥'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{act.title}</p>
                      <p className="text-xs text-[#6B7280]">
                        {new Date(act.timestamp).toLocaleDateString()} {new Date(act.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${act.type === 'withdrawal' ? 'text-orange-500' : 'text-[#27C46B]'}`}>
                    {act.type === 'withdrawal' ? '-' : '+'}${(parseFloat(String(act.amount)) || 0).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DepositModal
        open={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        addresses={addresses}
      />
    </Layout>
  );
}
