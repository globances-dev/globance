import Layout from "@/components/Layout";
import { User, LogOut, Users, MessageCircle, Copy, Check, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedRef, setCopiedRef] = useState(false);
  const [supportLinks, setSupportLinks] = useState({ telegram: "", whatsapp: "" });

  useEffect(() => {
    fetchUserData();
    fetchSupportLinks();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setUserData(data.user);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching user data:", error);
      setLoading(false);
    }
  };

  const fetchSupportLinks = async () => {
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();
      if (response.ok) {
        setSupportLinks({
          telegram: data.settings?.telegram_support || "",
          whatsapp: data.settings?.whatsapp_support || "",
        });
      }
    } catch (error) {
      console.error("Error fetching support links:", error);
    }
  };

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/register?ref=${userData?.ref_code}`;
    navigator.clipboard.writeText(referralLink);
    setCopiedRef(true);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleLogout = () => {
    tokenManager.removeToken();
    navigate("/login");
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-center text-[#9CA3AF]">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* User Info Card - Premium Dark Style */}
        <div className="rounded-xl p-4" style={{ background: '#181A20' }}>
          <div className="flex items-start gap-3">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ 
                background: '#F0B90B',
                boxShadow: '0 4px 12px rgba(240, 185, 11, 0.25)'
              }}
            >
              <User className="text-[#000000]" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate text-white">{userData?.full_name || userData?.email}</h1>
              <p className="text-sm text-[#9CA3AF] truncate">{userData?.email}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded-lg p-2" style={{ background: '#1E2126' }}>
                  <p className="text-xs text-[#6B7280] uppercase tracking-wide">User ID</p>
                  <p className="text-xs font-mono text-white">{userData?.id?.substring(0, 10)}</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: '#1E2126' }}>
                  <p className="text-xs text-[#6B7280] uppercase tracking-wide">Joined</p>
                  <p className="text-xs text-white">
                    {userData?.created_at ? new Date(userData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Program Section */}
        <div className="rounded-xl p-4" style={{ background: '#181A20' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(240, 185, 11, 0.15)' }}>
              <Users className="text-[#F0B90B]" size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Referral Program</h2>
              <p className="text-xs text-[#6B7280]">Earn 10%, 3%, 2% from your referrals</p>
            </div>
          </div>

          {/* Referral Link */}
          <div className="rounded-lg p-3 mb-3" style={{ background: '#1E2126' }}>
            <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">Your Referral Link</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/register?ref=${userData?.ref_code}`}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-mono text-white h-9 min-w-0 border-0 outline-none"
                style={{ background: '#2B3139' }}
              />
              <button
                onClick={copyReferralLink}
                className="px-3 py-2 font-bold rounded-lg transition-all h-9 flex items-center gap-1.5 flex-shrink-0 text-sm hover:brightness-95 active:brightness-90"
                style={{
                  background: '#F0B90B',
                  color: '#000000',
                  boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
                }}
              >
                {copiedRef ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Dashboard Button */}
          <button
            onClick={() => navigate("/referral")}
            className="w-full px-4 py-2.5 font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm hover:brightness-95 active:brightness-90"
            style={{
              background: '#F0B90B',
              color: '#000000',
              boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
            }}
          >
            <TrendingUp size={16} />
            View Referral Dashboard
          </button>
        </div>

        {/* Customer Support Section */}
        <div className="rounded-xl p-4" style={{ background: '#181A20' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
              <MessageCircle className="text-[#3B82F6]" size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Customer Support</h2>
              <p className="text-xs text-[#6B7280]">Get help from our team</p>
            </div>
          </div>

          {/* Support Links */}
          <div className="space-y-2 mb-3">
            {supportLinks.telegram && (
              <a
                href={supportLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-lg transition-all"
                style={{ background: '#1E2126' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                  <MessageCircle className="text-[#3B82F6]" size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Telegram Support</p>
                  <p className="text-xs text-[#6B7280]">Chat with us on Telegram</p>
                </div>
              </a>
            )}

            {supportLinks.whatsapp && (
              <a
                href={supportLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-lg transition-all"
                style={{ background: '#1E2126' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(39, 196, 107, 0.15)' }}>
                  <MessageCircle className="text-[#27C46B]" size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">WhatsApp Support</p>
                  <p className="text-xs text-[#6B7280]">Message us on WhatsApp</p>
                </div>
              </a>
            )}
          </div>

          {/* Support Page Button */}
          <button
            onClick={() => navigate("/customer-support")}
            className="w-full px-4 py-2.5 font-semibold rounded-lg transition-all duration-200 text-sm"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              color: '#FFFFFF'
            }}
          >
            View Support Page
          </button>
        </div>

        {/* Logout Button - Red accent */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-colors text-sm"
          style={{
            background: 'rgba(255, 68, 68, 0.1)',
            color: '#FF4444',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </Layout>
  );
}
