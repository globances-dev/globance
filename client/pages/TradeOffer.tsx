import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";

interface Offer {
  id: string;
  side: "buy" | "sell";
  total_amount_usdt: number;
  remaining_amount_usdt: number;
  price_fiat_per_usdt: number;
  fiat_currency_code: string;
  country: string;
  min_limit_fiat: number;
  max_limit_fiat: number;
  user_id: string;
  users?: {
    email: string;
    ref_code: string;
  };
}

interface PaymentMethod {
  id: string;
  provider_name: string;
  account_name: string;
  fiat_currency_code: string;
}

export default function TradeOffer() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount_fiat: "",
    buyer_payment_method_id: "",
  });

  useEffect(() => {
    fetchOffer();
    fetchPaymentMethods();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const response = await fetch(`/api/p2p/offers/${offerId}`);
      const data = await response.json();
      if (response.ok) {
        setOffer(data.offer);
      } else {
        toast({
          title: "Error",
          description: "Offer not found",
          variant: "destructive",
        });
        navigate("/p2p");
      }
    } catch (error) {
      console.error("Failed to fetch offer:", error);
      navigate("/p2p");
    }
  };

  const fetchPaymentMethods = async () => {
    const token = tokenManager.getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch("/api/p2p/payment-methods", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setPaymentMethods(data.payment_methods || []);
      }
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    }
  };

  const calculateUSDT = () => {
    if (!formData.amount_fiat || !offer) return 0;
    return parseFloat(formData.amount_fiat) / offer.price_fiat_per_usdt;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!offer || !formData.buyer_payment_method_id) {
      toast({
        title: "Error",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    const amount_fiat = parseFloat(formData.amount_fiat);
    if (amount_fiat < offer.min_limit_fiat || amount_fiat > offer.max_limit_fiat) {
      toast({
        title: "Invalid Amount",
        description: `Amount must be between ${offer.min_limit_fiat} and ${offer.max_limit_fiat} ${offer.fiat_currency_code}`,
        variant: "destructive",
      });
      return;
    }

    const amount_usdt = calculateUSDT();

    try {
      setIsLoading(true);
      const token = tokenManager.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch("/api/p2p/trades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          offer_id: offerId,
          amount_usdt,
          buyer_payment_method_id: formData.buyer_payment_method_id,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: "Trade created successfully",
      });

      navigate(`/p2p/order/${data.trade.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!offer) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center py-8">Loading offer...</div>
        </div>
      </Layout>
    );
  }

  const isBuying = offer.side === "sell";
  const availablePaymentMethods = paymentMethods.filter(
    (pm) => pm.fiat_currency_code === offer.fiat_currency_code
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <Button variant="outline" onClick={() => navigate("/p2p")}>
            ← Back to P2P
          </Button>
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            {isBuying ? "Buy USDT" : "Sell USDT"}
          </h2>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Seller</span>
              <span className="font-medium">{offer.users?.ref_code || "Anonymous"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-bold">{(parseFloat(String(offer.price_fiat_per_usdt)) || 0).toFixed(2)} {offer.fiat_currency_code} / USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-medium">{(parseFloat(String(offer.remaining_amount_usdt)) || 0).toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Limits</span>
              <span className="font-medium">
                {(parseFloat(String(offer.min_limit_fiat)) || 0).toFixed(0)} - {(parseFloat(String(offer.max_limit_fiat)) || 0).toFixed(0)} {offer.fiat_currency_code}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount to {isBuying ? "pay" : "receive"} ({offer.fiat_currency_code})
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Min: ${offer.min_limit_fiat} Max: ${offer.max_limit_fiat}`}
                value={formData.amount_fiat}
                onChange={(e) => setFormData({ ...formData, amount_fiat: e.target.value })}
                required
              />
              {formData.amount_fiat && (
                <p className="text-sm text-muted-foreground mt-1">
                  You will {isBuying ? "receive" : "send"}: {(parseFloat(String(calculateUSDT())) || 0).toFixed(2)} USDT
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Payment Method</label>
              {availablePaymentMethods.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 border border-border rounded">
                  <p>No payment methods available for {offer.fiat_currency_code}.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => navigate("/p2p/payment-methods")}
                  >
                    Add Payment Method
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.buyer_payment_method_id}
                  onValueChange={(value) => setFormData({ ...formData, buyer_payment_method_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePaymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.provider_name} - {pm.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || availablePaymentMethods.length === 0}>
              {isLoading ? "Creating Trade..." : `${isBuying ? "Buy" : "Sell"} USDT`}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        </Card>

        <Card className="p-4 bg-muted">
          <h3 className="font-semibold mb-2">Payment Window</h3>
          <p className="text-sm text-muted-foreground">
            Once you create this trade, you'll have 30 minutes to complete the payment. The seller's USDT will be held in escrow until you confirm payment.
          </p>
        </Card>
      </div>
    </Layout>
  );
}
