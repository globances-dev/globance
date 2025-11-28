import Layout from "@/components/Layout";
import { Zap, Clock, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";
import { useNavigate } from "react-router-dom";

interface Package {
  id: string;
  package_id: string;
  package_name: string;
  amount: number;
  daily_percent: number;
  start_date: string;
  end_date: string;
  days_remaining: number;
  total_earned: number;
  is_active: boolean;
}

export default function Mining() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/mining/my-packages", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setPackages(data.packages || []);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching packages:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-[#9CA3AF]">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">My Mining</h1>
            <p className="text-sm text-[#9CA3AF]">Active mining packages earning daily</p>
          </div>
          <button
            onClick={() => navigate("/packages")}
            className="px-4 py-2 font-bold rounded-lg transition-all text-sm hover:brightness-95 active:brightness-90"
            style={{
              background: '#F0B90B',
              color: '#000000',
              boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
            }}
          >
            + Buy Package
          </button>
        </div>

        {/* Active Packages */}
        <div className="space-y-3">
          {packages.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ background: '#181A20' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(240, 185, 11, 0.15)' }}>
                <Zap className="text-[#F0B90B]" size={28} />
              </div>
              <h3 className="text-lg font-bold mb-2 text-white">No Active Mining Packages</h3>
              <p className="text-[#9CA3AF] mb-5 text-sm">
                Start earning daily rewards by activating your first mining package
              </p>
              <button
                onClick={() => navigate("/packages")}
                className="px-5 py-2.5 font-bold rounded-lg transition-all text-sm hover:brightness-95 active:brightness-90"
                style={{
                  background: '#F0B90B',
                  color: '#000000',
                  boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
                }}
              >
                Browse Mining Packages
              </button>
            </div>
          ) : (
            packages.map((pkg) => {
              const progress = pkg.days_remaining > 0 
                ? ((270 - pkg.days_remaining) / 270) * 100 
                : 100;
              const dailyEarning = (pkg.amount * pkg.daily_percent) / 100;

              return (
                <div
                  key={pkg.id}
                  className="rounded-xl p-4"
                  style={{ background: '#181A20' }}
                >
                  {/* Package Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-base font-bold capitalize text-white">{pkg.package_name}</h3>
                      <p className="text-sm text-[#9CA3AF]">
                        ${(parseFloat(String(pkg.amount)) || 0).toFixed(2)} USDT Investment
                      </p>
                    </div>
                    <div 
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: pkg.is_active ? 'rgba(39, 196, 107, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        color: pkg.is_active ? '#27C46B' : '#6B7280'
                      }}
                    >
                      {pkg.is_active ? "Active" : "Completed"}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                      <p className="text-xs text-[#6B7280] mb-0.5">Daily Rate</p>
                      <p className="text-base font-bold text-[#F0B90B]">{pkg.daily_percent}%</p>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                      <p className="text-xs text-[#6B7280] mb-0.5">Daily Earning</p>
                      <p className="text-base font-bold text-[#27C46B]">+${(parseFloat(String(dailyEarning)) || 0).toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                      <p className="text-xs text-[#6B7280] mb-0.5">Total Earned</p>
                      <p className="text-base font-bold text-white">${(parseFloat(String(pkg.total_earned)) || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Progress Bar - Binance Style */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-[#9CA3AF]">
                      <span>Mining Progress</span>
                      <span>{pkg.days_remaining} days remaining</span>
                    </div>
                    <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: '#2B3139' }}>
                      <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{ 
                          width: `${progress}%`,
                          background: '#F0B90B'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6B7280]">
                        {new Date(pkg.start_date).toLocaleDateString()}
                      </span>
                      <span className="text-[#F0B90B] font-medium">{progress.toFixed(0)}%</span>
                      <span className="text-[#6B7280]">
                        {new Date(pkg.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary Stats */}
        {packages.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: '#181A20' }}>
            <h3 className="font-semibold mb-3 text-white text-sm">Mining Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: '#1E2126' }}>
                <p className="text-xs text-[#6B7280] mb-1">Total Investment</p>
                <p className="text-xl font-bold text-white">
                  ${packages.reduce((sum, p) => sum + (parseFloat(String(p.amount)) || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: '#1E2126' }}>
                <p className="text-xs text-[#6B7280] mb-1">Total Earned</p>
                <p className="text-xl font-bold text-[#27C46B]">
                  ${packages.reduce((sum, p) => sum + (parseFloat(String(p.total_earned)) || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
