import Layout from "@/components/Layout";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";

const PACKAGES = [
  {
    id: "bronze",
    name: "Bronze",
    description: "Entry-level power",
    minAmount: 10,
    dailyPercent: 2.5,
    duration: 270,
    referralsRequired: 0,
    color: "from-amber-600 to-amber-700",
  },
  {
    id: "silver",
    name: "Silver",
    description: "Stronger mining output",
    minAmount: 100,
    dailyPercent: 2.6,
    duration: 270,
    referralsRequired: 5,
    color: "from-gray-400 to-gray-500",
  },
  {
    id: "gold",
    name: "Gold",
    description: "Advanced mining power",
    minAmount: 300,
    dailyPercent: 2.7,
    duration: 270,
    referralsRequired: 10,
    color: "from-yellow-500 to-yellow-600",
    featured: true,
  },
  {
    id: "platinum",
    name: "Platinum",
    description: "Premium performance",
    minAmount: 500,
    dailyPercent: 2.8,
    duration: 270,
    referralsRequired: 15,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "diamond",
    name: "Diamond",
    description: "Elite mining strength",
    minAmount: 700,
    dailyPercent: 2.9,
    duration: 270,
    referralsRequired: 20,
    color: "from-cyan-400 to-cyan-500",
  },
  {
    id: "legendary",
    name: "Legendary",
    description: "Ultimate mining power",
    minAmount: 1000,
    dailyPercent: 3.0,
    duration: 270,
    referralsRequired: 25,
    color: "from-purple-600 to-purple-700",
  },
];

interface PurchaseModalProps {
  package: (typeof PACKAGES)[0];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function PurchaseModal({
  package: pkg,
  isOpen,
  onClose,
  onSuccess,
}: PurchaseModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(pkg.minAmount.toString());
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    try {
      setIsLoading(true);
      const token = tokenManager.getToken();

      if (!token) {
        toast({
          title: "Error",
          description: "You must be logged in to purchase",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/packages/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          package_id: pkg.id,
          amount: parseFloat(amount),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Purchase Failed",
          description: data.error || "Failed to process package purchase",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Package activated!",
        description: `${pkg.name} package activated for ${amount} USDT`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process purchase",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="rounded-xl p-5 max-w-md w-full mx-4" style={{ background: '#181A20' }}>
        <h2 className="text-xl font-bold mb-4 text-white">Buy {pkg.name} Package</h2>

        <div className="mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: '#1E2126' }}>
              <p className="text-[#6B7280] text-xs mb-1">Min Investment</p>
              <p className="text-lg font-bold text-white">{pkg.minAmount} USDT</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#1E2126' }}>
              <p className="text-[#6B7280] text-xs mb-1">Daily Rate</p>
              <p className="text-lg font-bold text-[#F0B90B]">{pkg.dailyPercent}%</p>
            </div>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-2 text-white">
              Activation Amount (USDT)
            </label>
            <input
              id="amount"
              type="number"
              min={pkg.minAmount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-white border-0 outline-none"
              style={{ background: '#2B3139' }}
              placeholder={pkg.minAmount.toString()}
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Minimum: {pkg.minAmount} USDT
            </p>
          </div>

          <div className="rounded-lg p-3" style={{ background: '#1E2126' }}>
            <p className="text-xs text-[#6B7280] mb-1">Estimated Daily Mining Rewards</p>
            <p className="text-lg font-bold text-[#27C46B]">
              {(parseFloat(amount) * pkg.dailyPercent * 0.01).toFixed(2)} USDT/day
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg font-semibold disabled:opacity-50 text-sm"
            style={{ background: '#2B3139', color: '#9CA3AF' }}
          >
            Cancel
          </button>
          <button
            onClick={handlePurchase}
            disabled={isLoading || parseFloat(amount) < pkg.minAmount}
            className="flex-1 px-4 py-2.5 rounded-lg font-bold disabled:opacity-50 text-sm hover:brightness-95 active:brightness-90"
            style={{
              background: '#F0B90B',
              color: '#000000',
              boxShadow: '0 2px 8px rgba(240,185,11,0.25)'
            }}
          >
            {isLoading ? "Processing..." : "Buy Package"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Packages() {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<
    (typeof PACKAGES)[0] | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOpenModal = (pkg: (typeof PACKAGES)[0]) => {
    setSelectedPackage(pkg);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Mining Packages</h1>
          <p className="text-sm text-[#9CA3AF]">Choose your mining power level</p>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.name}
              className="relative rounded-xl p-4 transition-all"
              style={{ 
                background: '#181A20',
                border: pkg.featured ? '1px solid #F0B90B' : '1px solid #2B3139'
              }}
            >
              {pkg.featured && (
                <div 
                  className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: '#F0B90B', color: '#12161C' }}
                >
                  Popular
                </div>
              )}

              {/* Package Name */}
              <h3 className="text-lg font-bold mb-1 text-white">{pkg.name}</h3>
              <p className="text-xs text-[#6B7280] mb-3">{(pkg as any).description}</p>

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                  <p className="text-xs text-[#6B7280]">Min Investment</p>
                  <p className="text-base font-bold text-[#F0B90B]">${pkg.minAmount}</p>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                  <p className="text-xs text-[#6B7280]">Daily Rate</p>
                  <p className="text-base font-bold text-[#27C46B]">{pkg.dailyPercent}%</p>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                  <p className="text-xs text-[#6B7280]">Referrals</p>
                  <p className="text-base font-bold text-white">{pkg.referralsRequired}</p>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: '#1E2126' }}>
                  <p className="text-xs text-[#6B7280]">Duration</p>
                  <p className="text-base font-bold text-white">{pkg.duration}d</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-1.5 mb-4 py-3" style={{ borderTop: '1px solid #2B3139' }}>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-[#27C46B] flex-shrink-0" />
                  <span className="text-xs text-[#9CA3AF]">Auto daily rewards</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-[#27C46B] flex-shrink-0" />
                  <span className="text-xs text-[#9CA3AF]">3-level referral bonus</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-[#27C46B] flex-shrink-0" />
                  <span className="text-xs text-[#9CA3AF]">Fast withdrawals</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleOpenModal(pkg)}
                className="w-full py-2.5 font-bold rounded-lg transition-all text-sm hover:brightness-95 active:brightness-90"
                style={{
                  background: pkg.featured ? '#F0B90B' : 'rgba(240, 185, 11, 0.15)',
                  color: pkg.featured ? '#000000' : '#F0B90B',
                  boxShadow: pkg.featured ? '0 2px 8px rgba(240,185,11,0.25)' : 'none'
                }}
              >
                Activate {pkg.name}
              </button>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="rounded-xl p-4 text-center" style={{ background: '#181A20' }}>
          <h3 className="text-base font-bold mb-2 text-white">Investment Requirements</h3>
          <p className="text-xs text-[#9CA3AF] max-w-2xl mx-auto">
            <span className="text-[#F0B90B] font-semibold">Hybrid Rule:</span> To activate Silver and higher packages, 
            you must meet both the minimum deposit amount AND have the required number of referrals who have made an investment.
          </p>
        </div>
      </div>

      {/* Purchase Modal */}
      {selectedPackage && (
        <PurchaseModal
          key={refreshKey}
          package={selectedPackage}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </Layout>
  );
}
