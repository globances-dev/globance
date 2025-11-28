import Layout from "@/components/Layout";
import DepositModal from "@/components/DepositModal";
import WithdrawalModal from "@/components/WithdrawalModal";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet as WalletIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { wallet, tokenManager } from "@/lib/api";

interface DepositAddress {
  network: string;
  address: string;
}

interface Deposit {
  id: string;
  amount: number;
  network: string;
  status: string;
  created_at: string;
  txid?: string;
}

interface Withdrawal {
  id: string;
  amount_usdt?: number;
  amount?: number;
  fee_usdt?: number;
  fee?: number;
  net_amount_usdt?: number;
  net_amount?: number;
  network: string;
  address: string;
  status: string;
  created_at: string;
  txid?: string;
}

export default function Wallet() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | string>(0);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const token = tokenManager.getToken();
      if (!token) {
        toast({
          title: "Not Logged In",
          description: "Please log in to view your wallet",
          variant: "destructive",
        });
        return;
      }

      try {
        const balanceRes = await wallet.getBalance(token);
        setBalance(parseFloat(String(balanceRes.usdt_balance)) || 0);
      } catch (err) {
        console.error("Error fetching balance:", err);
        setBalance(0);
      }

      try {
        const addressesRes = await wallet.getDepositAddresses(token);
        setAddresses(addressesRes.addresses || []);
      } catch (err) {
        console.error("Error fetching deposit addresses:", err);
        setAddresses([]);
      }

      try {
        const depositsRes = await wallet.getDepositHistory(token);
        setDeposits(depositsRes.deposits || []);
      } catch (err) {
        console.error("Error fetching deposit history:", err);
        setDeposits([]);
      }

      try {
        const withdrawalsRes = await wallet.getWithdrawalHistory(token);
        setWithdrawals(withdrawalsRes.withdrawals || []);
      } catch (err) {
        console.error("Error fetching withdrawal history:", err);
        setWithdrawals([]);
      }

      setLoading(false);
    } catch (error: any) {
      console.error("Error fetching wallet data:", error);
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          icon: <CheckCircle2 size={16} />,
          color: "text-green-500",
          bgColor: "bg-green-500",
          label: "Completed"
        };
      case "pending":
      case "processing":
        return {
          icon: <Clock size={16} />,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500",
          label: "Pending"
        };
      case "failed":
      case "rejected":
        return {
          icon: <XCircle size={16} />,
          color: "text-red-500",
          bgColor: "bg-red-500",
          label: "Failed"
        };
      default:
        return {
          icon: <AlertCircle size={16} />,
          color: "text-gray-500",
          bgColor: "bg-gray-500",
          label: status
        };
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Loading wallet...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const numBalance = typeof balance === 'number' ? balance : parseFloat(String(balance)) || 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Balance Card - Premium Dark Gradient */}
        <div className="relative overflow-hidden rounded-xl p-5" style={{
          background: 'linear-gradient(135deg, #181A20 0%, #0F1115 100%)',
          boxShadow: '0 0 40px rgba(240, 185, 11, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#F0B90B]/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs text-[#A7B0BB] uppercase tracking-wide mb-1">Total Balance</p>
            <h2 className="text-3xl font-bold mb-4">
              ${numBalance.toFixed(2)} <span className="text-base text-[#6F7680]">USDT</span>
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
                onClick={() => setWithdrawalModalOpen(true)}
                disabled={numBalance < 10}
                className="flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm hover:brightness-95 active:brightness-90"
                style={{
                  background: numBalance >= 10 ? '#1E4AFF' : '#2B3139',
                  color: numBalance >= 10 ? '#FFFFFF' : '#6F7680',
                  boxShadow: numBalance >= 10 ? '0 2px 8px rgba(30, 74, 255, 0.25)' : 'none'
                }}
              >
                <ArrowUpRight size={16} />
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* Recent Deposits - Timeline Style */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-white">
            <ArrowDownLeft size={16} className="text-[#27C46B]" />
            Recent Deposits
          </h3>
          
          {deposits.length > 0 ? (
            <div className="space-y-2">
              {deposits.map((deposit, index) => {
                const statusConfig = getStatusConfig(deposit.status);
                const { date, time } = formatDateTime(deposit.created_at || new Date().toISOString());
                const amount = parseFloat(String(deposit.amount)) || 0;
                
                return (
                  <div key={deposit.id} className="relative">
                    {/* Timeline connector line */}
                    {index < deposits.length - 1 && (
                      <div className="absolute left-[11px] top-[32px] w-0.5 h-[calc(100%+12px)]" style={{ background: '#2B3139' }} />
                    )}
                    
                    {/* Transaction Card */}
                    <div className="flex gap-3">
                      {/* Timeline Node */}
                      <div className="flex-shrink-0 relative z-10">
                        <div className={`w-6 h-6 rounded-full ${statusConfig.bgColor} flex items-center justify-center`}>
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 rounded-xl p-3 transition-colors" style={{ background: '#181A20' }}>
                        {/* Main Line */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#27C46B]">+{amount.toFixed(2)} USDT</span>
                            <span className={`text-xs ${statusConfig.color}`}>— {statusConfig.label}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(240, 185, 11, 0.15)', color: '#F0B90B' }}>
                            {deposit.network}
                          </span>
                        </div>
                        
                        {/* Sub Text */}
                        <div className="text-xs text-[#6B7280]">
                          {date} — {time}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl p-5 text-center" style={{ background: '#181A20' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(39, 196, 107, 0.15)' }}>
                <WalletIcon className="text-[#27C46B]" size={18} />
              </div>
              <p className="text-sm text-[#9CA3AF]">No deposits yet</p>
              <p className="text-xs text-[#6B7280] mt-1">
                Your deposit transactions will appear here
              </p>
            </div>
          )}
        </div>

        {/* Recent Withdrawals - Timeline Style */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-white">
            <ArrowUpRight size={16} className="text-[#3B82F6]" />
            Recent Withdrawals
          </h3>
          
          {withdrawals.length > 0 ? (
            <div className="space-y-2">
              {withdrawals.map((withdrawal, index) => {
                const statusConfig = getStatusConfig(withdrawal.status || 'pending');
                const { date, time } = formatDateTime(withdrawal.created_at || new Date().toISOString());
                const amount = parseFloat(String(withdrawal.amount || withdrawal.amount_usdt)) || 0;
                const fee = parseFloat(String(withdrawal.fee || withdrawal.fee_usdt)) || 1;
                const netAmount = parseFloat(String(withdrawal.net_amount || withdrawal.net_amount_usdt)) || (amount - fee);
                
                return (
                  <div key={withdrawal.id} className="relative">
                    {/* Timeline connector line */}
                    {index < withdrawals.length - 1 && (
                      <div className="absolute left-[11px] top-[32px] w-0.5 h-[calc(100%+12px)]" style={{ background: '#2B3139' }} />
                    )}
                    
                    {/* Transaction Card */}
                    <div className="flex gap-3">
                      {/* Timeline Node */}
                      <div className="flex-shrink-0 relative z-10">
                        <div className={`w-6 h-6 rounded-full ${statusConfig.bgColor} flex items-center justify-center`}>
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 rounded-xl p-3 transition-colors" style={{ background: '#181A20' }}>
                        {/* Main Line */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">-{amount.toFixed(2)} USDT</span>
                            <span className={`text-xs ${statusConfig.color}`}>— {statusConfig.label}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
                            {withdrawal.network || 'TRC20'}
                          </span>
                        </div>
                        
                        {/* Sub Text */}
                        <div className="flex items-center justify-between text-xs text-[#6B7280]">
                          <span>{date} — {time}</span>
                          <span>Fee: {fee.toFixed(2)} USDT</span>
                        </div>
                        
                        {/* Net Amount */}
                        <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid #2B3139' }}>
                          <span className="text-xs text-[#6B7280]">Net: </span>
                          <span className="text-xs font-semibold text-[#27C46B]">{netAmount.toFixed(2)} USDT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl p-5 text-center" style={{ background: '#181A20' }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                <ArrowUpRight className="text-[#3B82F6]" size={18} />
              </div>
              <p className="text-sm text-[#9CA3AF]">No withdrawals yet</p>
              <p className="text-xs text-[#6B7280] mt-1">
                Your withdrawal transactions will appear here
              </p>
            </div>
          )}
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
        onSuccess={fetchWalletData}
      />
    </Layout>
  );
}
