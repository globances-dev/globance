import { useState, useEffect } from "react";
import { useToast } from "../../hooks/use-toast";
import { tokenManager } from "../../lib/api";
import { AlertCircle, User, DollarSign, Clock, CheckCircle, XCircle, FileText } from "lucide-react";

interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  amount_usdt: number;
  total_fiat: number;
  escrow_amount_usdt: number;
  status: string;
  payment_deadline: string;
  dispute_reason?: string;
  dispute_notes?: any;
  created_at: string;
  buyer: {
    email: string;
    ref_code: string;
  };
  seller: {
    email: string;
    ref_code: string;
  };
  offers: {
    fiat_currency_code: string;
    price_fiat_per_usdt: number;
  };
}

export default function DisputeResolution() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Trade | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      const response = await fetch("/api/p2p/trades/admin/disputes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDisputes(data.trades || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load disputes",
          variant: "destructive",
        });
      }
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

  const handleResolve = async (resolution: "buyer" | "seller") => {
    if (!selectedDispute) return;

    if (
      !confirm(
        `Are you sure you want to release funds to ${resolution === "buyer" ? "BUYER" : "SELLER"}?\n\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setResolving(true);
      const token = tokenManager.getToken();
      const response = await fetch(
        `/api/p2p/trades/${selectedDispute.id}/resolve-dispute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resolution,
            notes: resolutionNotes,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: `Dispute resolved in favor of ${resolution}`,
        });
        setSelectedDispute(null);
        setResolutionNotes("");
        fetchDisputes();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to resolve dispute",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">P2P Dispute Resolution</h2>
        <p className="text-muted-foreground text-sm">
          Review and resolve disputed trades
        </p>
      </div>

      {/* Dispute List */}
      {loading ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Loading disputes...</p>
        </div>
      ) : disputes.length === 0 ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <CheckCircle className="mx-auto mb-4 text-primary" size={48} />
          <h3 className="text-xl font-bold mb-2">No Active Disputes</h3>
          <p className="text-muted-foreground">
            All P2P trades are running smoothly!
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="card-gradient border border-destructive/30 rounded-lg p-6 hover:border-destructive/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-destructive" size={24} />
                  <div>
                    <h3 className="font-bold">Trade #{dispute.id.slice(0, 8)}</h3>
                    <p className="text-xs text-muted-foreground">
                      Opened: {formatDate(dispute.created_at)}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-destructive/20 text-destructive rounded text-xs font-medium">
                  DISPUTED
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Buyer</p>
                  <p className="font-medium text-sm">{dispute.buyer.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Ref: {dispute.buyer.ref_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Seller</p>
                  <p className="font-medium text-sm">{dispute.seller.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Ref: {dispute.seller.ref_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Amount</p>
                  <p className="font-bold text-lg">{dispute.amount_usdt} USDT</p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {dispute.total_fiat} {dispute.offers.fiat_currency_code}
                  </p>
                </div>
              </div>

              {dispute.dispute_reason && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Dispute Reason:</p>
                  <p className="text-sm">{dispute.dispute_reason}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDispute(dispute)}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Review & Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="text-destructive" size={28} />
              <div>
                <h2 className="text-2xl font-bold">Resolve Dispute</h2>
                <p className="text-sm text-muted-foreground">
                  Trade #{selectedDispute.id.slice(0, 8)}
                </p>
              </div>
            </div>

            {/* Trade Details */}
            <div className="card-gradient border border-border rounded-lg p-6 mb-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <FileText size={18} />
                Trade Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Trade Amount</p>
                  <p className="font-bold text-lg">
                    {selectedDispute.amount_usdt} USDT
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {selectedDispute.total_fiat}{" "}
                    {selectedDispute.offers.fiat_currency_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Escrow Amount
                  </p>
                  <p className="font-bold text-lg">
                    {selectedDispute.escrow_amount_usdt} USDT
                  </p>
                  <p className="text-sm text-muted-foreground">Locked in escrow</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Buyer</p>
                  <p className="font-medium">{selectedDispute.buyer.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Ref: {selectedDispute.buyer.ref_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Seller</p>
                  <p className="font-medium">{selectedDispute.seller.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Ref: {selectedDispute.seller.ref_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm">{formatDate(selectedDispute.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Payment Deadline
                  </p>
                  <p className="text-sm">
                    {formatDate(selectedDispute.payment_deadline)}
                  </p>
                </div>
              </div>

              {selectedDispute.dispute_reason && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Dispute Reason:
                  </p>
                  <p className="text-sm">{selectedDispute.dispute_reason}</p>
                </div>
              )}
            </div>

            {/* Resolution Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Resolution Notes (optional)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about why you made this decision..."
                rows={4}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Resolution Actions */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleResolve("buyer")}
                  disabled={resolving}
                  className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Release to Buyer
                </button>
                <button
                  onClick={() => handleResolve("seller")}
                  disabled={resolving}
                  className="px-4 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Return to Seller
                </button>
              </div>
              <button
                onClick={() => {
                  setSelectedDispute(null);
                  setResolutionNotes("");
                }}
                disabled={resolving}
                className="w-full px-4 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 p-3 bg-muted/50 border border-border rounded text-xs text-muted-foreground">
              <p className="font-medium mb-1">⚠️ Important:</p>
              <p>
                • <strong>Release to Buyer:</strong> Funds go to buyer's wallet
                (buyer wins)
              </p>
              <p>
                • <strong>Return to Seller:</strong> Funds returned to seller's
                wallet (seller wins)
              </p>
              <p className="mt-2">This action is permanent and cannot be undone.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
