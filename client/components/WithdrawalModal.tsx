import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { wallet, tokenManager } from "@/lib/api";

interface WithdrawalModalProps {
  open: boolean;
  onClose: () => void;
  balance: number | string;
  onSuccess: () => void;
}

export default function WithdrawalModal({
  open,
  onClose,
  balance,
  onSuccess,
}: WithdrawalModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    network: "TRC20",
    address: "",
  });

  const WITHDRAWAL_FEE = 1; // Fixed 1 USDT withdrawal fee
  const MIN_WITHDRAWAL = 10; // 10 USDT minimum

  const numBalance = typeof balance === 'number' ? balance : parseFloat(String(balance) || '0') || 0;
  const amount = parseFloat(formData.amount) || 0;
  const fee = WITHDRAWAL_FEE;
  const netAmount = amount - fee; // Net amount user receives after fee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount < MIN_WITHDRAWAL) {
      toast({
        title: "Invalid Amount",
        description: `Minimum withdrawal is ${MIN_WITHDRAWAL} USDT`,
        variant: "destructive",
      });
      return;
    }

    if (amount > numBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${amount.toFixed(2)} USDT. Available: ${numBalance.toFixed(2)} USDT`,
        variant: "destructive",
      });
      return;
    }

    // Validate address format based on network
    let addressError = "";
    if (!formData.address) {
      addressError = "Wallet address is required";
    } else if (formData.network === "TRC20") {
      // TRC20: Must start with T and be 34 chars
      if (!formData.address.startsWith("T")) {
        addressError = "TRC20 address must start with 'T'";
      } else if (formData.address.length !== 34) {
        addressError = "TRC20 address must be exactly 34 characters";
      }
    } else if (formData.network === "BEP20") {
      // BEP20: Must start with 0x and be 42 chars
      if (!formData.address.startsWith("0x")) {
        addressError = "BEP20 address must start with '0x'";
      } else if (formData.address.length !== 42) {
        addressError = "BEP20 address must be exactly 42 characters";
      }
    }

    if (addressError) {
      toast({
        title: "Invalid Address Format",
        description: addressError,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const token = tokenManager.getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          network: formData.network,
          address: formData.address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      toast({
        title: "Withdrawal Request Submitted",
        description: `${amount.toFixed(2)} USDT deducted from your balance. Your withdrawal will be processed by our team shortly. You'll receive ${netAmount.toFixed(2)} USDT after the ${fee.toFixed(2)} USDT fee.`,
      });

      setFormData({ amount: "", network: "TRC20", address: "" });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to create withdrawal request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
        {/* Fixed Header */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Withdraw Your Earnings</DialogTitle>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto px-6 flex-1">
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Balance Display */}
            <div className="bg-secondary rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold">{numBalance.toFixed(2)} USDT</p>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">Amount (USDT)</label>
              <input
                type="number"
                step="0.01"
                min={MIN_WITHDRAWAL}
                max={numBalance}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={`Min: ${MIN_WITHDRAWAL} USDT`}
                required
              />
            </div>

            {/* Network */}
            <div>
              <label className="block text-sm font-medium mb-2">Network</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, network: "TRC20" })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    formData.network === "TRC20"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">TRC20</div>
                  <div className="text-xs text-muted-foreground">TRON</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, network: "BEP20" })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    formData.network === "BEP20"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold">BEP20</div>
                  <div className="text-xs text-muted-foreground">BSC</div>
                </button>
              </div>
            </div>

            {/* Withdrawal Address */}
            <div>
              <label className="block text-sm font-medium mb-2">Withdrawal Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder={formData.network === "TRC20" ? "T..." : "0x..."}
                required
              />
            </div>

            {/* Withdrawal Summary */}
            {amount >= MIN_WITHDRAWAL && (
              <div className="bg-secondary rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Withdrawal Amount:</span>
                  <span className="font-medium">{amount.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fee:</span>
                  <span className="font-medium text-yellow-600">-{fee.toFixed(2)} USDT</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold">You'll Receive:</span>
                  <span className="font-bold text-primary">{netAmount.toFixed(2)} USDT</span>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex gap-2">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Important:</p>
                <ul className="space-y-1">
                  <li>• Double-check your address - withdrawals cannot be reversed</li>
                  <li>• Instant automatic processing</li>
                  <li>• Minimum: {MIN_WITHDRAWAL} USDT | Fee: {WITHDRAWAL_FEE} USDT fixed</li>
                </ul>
              </div>
            </div>
          </form>
        </div>

        {/* Fixed Footer Button */}
        <div className="px-6 pb-6 pt-4 border-t border-border flex-shrink-0 bg-background">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || amount < MIN_WITHDRAWAL || amount > numBalance}
            className="w-full px-6 py-3 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: (loading || amount < MIN_WITHDRAWAL || amount > numBalance) ? undefined : '#1E4AFF',
              color: (loading || amount < MIN_WITHDRAWAL || amount > numBalance) ? undefined : '#FFFFFF',
              boxShadow: (loading || amount < MIN_WITHDRAWAL || amount > numBalance) ? 'none' : '0 2px 8px rgba(30, 74, 255, 0.25)'
            }}
            onMouseEnter={(e) => {
              if (!loading && amount >= MIN_WITHDRAWAL && amount <= numBalance) {
                e.currentTarget.style.backgroundColor = '#1740E0';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && amount >= MIN_WITHDRAWAL && amount <= numBalance) {
                e.currentTarget.style.backgroundColor = '#1E4AFF';
              }
            }}
            onMouseDown={(e) => {
              if (!loading && amount >= MIN_WITHDRAWAL && amount <= numBalance) {
                e.currentTarget.style.backgroundColor = '#1236C0';
              }
            }}
            onMouseUp={(e) => {
              if (!loading && amount >= MIN_WITHDRAWAL && amount <= numBalance) {
                e.currentTarget.style.backgroundColor = '#1740E0';
              }
            }}
          >
            {loading ? "Processing..." : "Withdraw Now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
