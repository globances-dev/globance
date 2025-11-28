import Layout from "@/components/Layout";
import { Copy, Gift, Users, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";

interface ReferralData {
  ref_code: string;
  referral_count: number;
  level1_count: number;
  level2_count: number;
  level3_count: number;
  total_referral_earnings: number;
}

interface ReferredUser {
  email: string;
  level: number;
  joined_date: string;
  total_earned: number;
}

export default function Referral() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch user info for ref_code
      const userRes = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!userRes.ok) {
        setLoading(false);
        return;
      }

      const userData = await userRes.json();
      const user = userData.user;

      // Fetch referral tree and stats
      const userId = user.id;
      const treeRes = await fetch(`/api/admin/referral-tree/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const statsRes = await fetch(`/api/admin/referral-stats/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let level1Count = 0;
      let level2Count = 0;
      let level3Count = 0;
      let totalEarnings = 0;
      let referred: ReferredUser[] = [];

      if (treeRes.ok) {
        const treeData = await treeRes.json();
        const tree = treeData.referralTree || [];
        level1Count = tree.length;

        // Count Level 2
        tree.forEach((l1: any) => {
          level2Count += l1.referrals?.length || 0;
          // Count Level 3
          l1.referrals?.forEach((l2: any) => {
            level3Count += l2.referrals?.length || 0;
          });
        });
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        totalEarnings = statsData.total_referral_earnings || 0;
        
        // Build referred users list
        if (statsData.referrals) {
          referred = statsData.referrals.map((ref: any) => ({
            email: ref.email,
            level: ref.level,
            joined_date: ref.created_at,
            total_earned: ref.total_earned_from || 0,
          }));
        }
      }

      setReferralData({
        ref_code: user.ref_code,
        referral_count: level1Count,
        level1_count: level1Count,
        level2_count: level2Count,
        level3_count: level3Count,
        total_referral_earnings: totalEarnings,
      });

      setReferredUsers(referred);
    } catch (error) {
      console.error("Failed to fetch referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (referralData?.ref_code) {
      navigator.clipboard.writeText(referralData.ref_code);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
    }
  };

  const handleCopyLink = () => {
    if (referralData?.ref_code) {
      const referralLink = `https://globance.app/register?ref=${referralData.ref_code}`;
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-center text-[#9CA3AF]">Loading referral data...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">Referral Program</h1>
          <p className="text-sm text-[#9CA3AF]">Invite friends and earn commission on their packages and daily rewards</p>
        </div>

        {/* Group A: Referral Stats - Compact 4-Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#6B7280] font-semibold">Level 1</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(240, 185, 11, 0.15)' }}>
                <Users className="text-[#F0B90B]" size={14} />
              </div>
            </div>
            <p className="text-xl font-bold text-white">{referralData?.level1_count || 0}</p>
            <p className="text-xs text-[#6B7280] mt-1">Direct (10%)</p>
          </div>

          <div className="rounded-lg p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#6B7280] font-semibold">Level 2</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                <Users className="text-[#3B82F6]" size={14} />
              </div>
            </div>
            <p className="text-xl font-bold text-white">{referralData?.level2_count || 0}</p>
            <p className="text-xs text-[#6B7280] mt-1">Their refs (3%)</p>
          </div>

          <div className="rounded-lg p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#6B7280] font-semibold">Level 3</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(147, 51, 234, 0.15)' }}>
                <Users className="text-purple-500" size={14} />
              </div>
            </div>
            <p className="text-xl font-bold text-white">{referralData?.level3_count || 0}</p>
            <p className="text-xs text-[#6B7280] mt-1">Third level (2%)</p>
          </div>

          <div className="rounded-lg p-3" style={{ background: '#181A20' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#6B7280] font-semibold">Total Earned</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(39, 196, 107, 0.15)' }}>
                <TrendingUp className="text-[#27C46B]" size={14} />
              </div>
            </div>
            <p className="text-xl font-bold text-[#27C46B]">${(parseFloat(String(referralData?.total_referral_earnings)) || 0).toFixed(2)}</p>
            <p className="text-xs text-[#6B7280] mt-1">USDT earned</p>
          </div>
        </div>

        {/* Group B: Referral Code & Link - Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg p-4" style={{ background: '#181A20' }}>
            <p className="text-sm font-bold mb-3 text-white">Your Referral Code</p>
            <div className="rounded-lg p-3 mb-3" style={{ background: '#1E2126' }}>
              <p className="text-lg font-mono font-bold text-center text-[#F0B90B]">
                {referralData?.ref_code || "N/A"}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="w-full px-4 py-2.5 font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm hover:brightness-95 active:brightness-90"
              style={{
                background: '#F0B90B',
                color: '#000000',
                boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
              }}
            >
              <Copy size={16} />
              Copy Code
            </button>
          </div>

          <div className="rounded-lg p-4" style={{ background: '#181A20' }}>
            <p className="text-sm font-bold mb-3 text-white">Your Referral Link</p>
            <div className="rounded-lg p-3 mb-3" style={{ background: '#1E2126' }}>
              <p className="text-xs font-mono break-all text-[#9CA3AF]">
                https://globance.app/register?ref={referralData?.ref_code || "N/A"}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full px-4 py-2.5 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: '#FFFFFF'
              }}
            >
              <Copy size={16} />
              Copy Link
            </button>
          </div>
        </div>

        {/* Group C: Rewards Structure - Compact */}
        <div className="rounded-lg p-4" style={{ background: '#181A20' }}>
          <p className="font-bold mb-4 text-white text-sm">Reward Structure</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Level 1 */}
            <div className="rounded-lg p-3" style={{ background: '#1E2126', border: '1px solid rgba(240, 185, 11, 0.2)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm text-white">Level 1</p>
                <div className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(240, 185, 11, 0.15)', color: '#F0B90B' }}>10%</div>
              </div>
              <p className="text-xs text-[#6B7280] mb-2">Direct referrals</p>
              <ul className="space-y-1 text-xs text-[#9CA3AF]">
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                  <span>10% on purchases</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                  <span>10% on daily earnings</span>
                </li>
              </ul>
            </div>

            {/* Level 2 */}
            <div className="rounded-lg p-3" style={{ background: '#1E2126', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm text-white">Level 2</p>
                <div className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>3%</div>
              </div>
              <p className="text-xs text-[#6B7280] mb-2">Their referrals</p>
              <ul className="space-y-1 text-xs text-[#9CA3AF]">
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#3B82F6] rounded-full" />
                  <span>3% on purchases</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-[#3B82F6] rounded-full" />
                  <span>3% on daily earnings</span>
                </li>
              </ul>
            </div>

            {/* Level 3 */}
            <div className="rounded-lg p-3" style={{ background: '#1E2126', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm text-white">Level 3</p>
                <div className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(147, 51, 234, 0.15)', color: '#9333EA' }}>2%</div>
              </div>
              <p className="text-xs text-[#6B7280] mb-2">Third level</p>
              <ul className="space-y-1 text-xs text-[#9CA3AF]">
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-purple-500 rounded-full" />
                  <span>2% on purchases</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-purple-500 rounded-full" />
                  <span>2% on daily earnings</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Group D: Referred Users - Compact */}
        <div className="rounded-lg p-4" style={{ background: '#181A20' }}>
          <p className="font-bold mb-4 text-white text-sm">Your Referred Users</p>
          {referredUsers.length === 0 ? (
            <div className="text-center py-6 rounded-lg" style={{ background: '#1E2126' }}>
              <Users className="mx-auto text-[#6B7280] mb-3" size={28} />
              <p className="text-[#9CA3AF] text-sm mb-1">No referrals yet</p>
              <p className="text-xs text-[#6B7280]">Share your referral link to start earning</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #2B3139' }}>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280]">User Email</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280]">Level</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280]">Joined</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#6B7280]">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {referredUsers.map((user, idx) => (
                    <tr key={idx} className="hover:bg-[#1E2126]" style={{ borderBottom: '1px solid #2B3139' }}>
                      <td className="py-2 px-3 text-xs text-white">{user.email}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'rgba(240, 185, 11, 0.15)', color: '#F0B90B' }}>
                          L{user.level}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-[#9CA3AF]">
                        {new Date(user.joined_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-xs font-semibold text-[#27C46B]">${(parseFloat(String(user.total_earned)) || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
