import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Filter, ArrowRight, MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";
import { useNavigate } from "react-router-dom";

// Helper function to safely format numbers from API
const formatNum = (val: any, decimals: number = 2): string => {
  const num = parseFloat(String(val));
  return isNaN(num) ? "0".padEnd(decimals > 0 ? decimals + 2 : 1, decimals > 0 ? ".00".substring(0, decimals + 1) : "") : num.toFixed(decimals);
};

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("P2P Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Layout>
          <div className="max-w-7xl mx-auto p-4 md:p-6 min-h-screen">
            <Card className="p-6 bg-destructive/10 border-destructive">
              <h2 className="text-xl font-bold text-destructive mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || "An error occurred while loading the P2P page"}
              </p>
              <Button
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </Card>
          </div>
        </Layout>
      );
    }

    return this.props.children;
  }
}

interface FiatCurrency {
  id: string;
  code: string;
  name: string;
  country: string;
  min_price: number;
  max_price: number;
}

interface PaymentMethod {
  id: string;
  type: string;
  provider_name: string;
  fiat_currency_code: string;
  account_name: string;
  account_number: string;
}

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
  payment_method_ids: string[];
  is_active: boolean;
  users?: {
    email: string;
    ref_code: string;
  };
}

interface Trade {
  id: string;
  offer_id: string;
  amount_usdt: number;
  total_fiat: number;
  fiat_currency_code: string;
  status: string;
  created_at: string;
  payment_deadline: string;
  buyer: { id: string; email: string };
  seller: { id: string; email: string };
}

function P2P() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("buy");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [myTrades, setMyTrades] = useState<Trade[]>([]);
  const [currencies, setCurrencies] = useState<FiatCurrency[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createOfferOpen, setCreateOfferOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchCurrencies();
        await fetchOffers();
        await fetchMyOffers();
        await fetchMyTrades();
        await fetchPaymentMethods();
      } catch (error) {
        console.error("Error loading P2P data:", error);
      }
    };
    loadData();
  }, [selectedTab]);

  const fetchCurrencies = async () => {
    try {
      const response = await fetch("/api/p2p/fiat");
      const data = await response.json();
      if (response.ok) {
        setCurrencies(data.currencies || []);
        if (data.currencies?.length > 0 && !selectedCurrency) {
          setSelectedCurrency(data.currencies[0].code);
        }
      }
    } catch (error) {
      console.error("Failed to fetch currencies:", error);
    }
  };

  const fetchOffers = async () => {
    try {
      setIsLoading(true);
      let url = `/api/p2p/offers?side=${selectedTab}`;
      if (selectedCurrency) url += `&fiat_currency_code=${selectedCurrency}`;
      if (filterCountry) url += `&country=${filterCountry}`;

      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        // Safely filter and validate offers
        const validOffers = (data.offers || []).filter((offer: any) => {
          return offer && offer.id && offer.side && offer.fiat_currency_code;
        });
        setOffers(validOffers);
      }
    } catch (error) {
      console.error("Failed to fetch offers:", error);
      setOffers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyOffers = async () => {
    const token = tokenManager.getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/p2p/offers/my-offers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        // Safely filter and validate offers
        const validOffers = (data.offers || []).filter((offer: any) => {
          return offer && offer.id && offer.side && offer.fiat_currency_code;
        });
        setMyOffers(validOffers);
      }
    } catch (error) {
      console.error("Failed to fetch my offers:", error);
      setMyOffers([]);
    }
  };

  const fetchMyTrades = async () => {
    const token = tokenManager.getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/p2p/trades/my-trades", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setMyTrades(data.trades || []);
      }
    } catch (error) {
      console.error("Failed to fetch my trades:", error);
    }
  };

  const fetchPaymentMethods = async () => {
    const token = tokenManager.getToken();
    if (!token) return;

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

  const handleTakeOffer = (offerId: string) => {
    navigate(`/p2p/trade/${offerId}`);
  };

  const getTradeStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
      pending: { label: "Pending Payment", variant: "outline" },
      payment_sent: { label: "Payment Sent", variant: "secondary" },
      released: { label: "Completed", variant: "default" },
      cancelled: { label: "Cancelled", variant: "destructive" },
      expired: { label: "Expired", variant: "destructive" },
      disputed: { label: "Disputed", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6 min-h-screen">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-4">
          <div className="w-full">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">P2P Trading</h1>
            <p className="text-sm md:text-base text-muted-foreground">Buy and sell USDT directly with other users</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate("/p2p/payment-methods")}>
              Payment Methods
            </Button>
            <Button onClick={() => setCreateOfferOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Offer
            </Button>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full max-w-full md:max-w-md grid-cols-4 bg-transparent p-0 gap-2">
            <TabsTrigger 
              value="buy"
              style={{
                backgroundColor: selectedTab === "buy" ? "#22c55e" : "transparent",
                color: selectedTab === "buy" ? "white" : "inherit",
                fontWeight: selectedTab === "buy" ? "600" : "400",
              }}
              className="text-xs md:text-sm transition-all rounded-lg"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger 
              value="sell"
              style={{
                backgroundColor: selectedTab === "sell" ? "#3B82F6" : "transparent",
                color: selectedTab === "sell" ? "white" : "inherit",
                fontWeight: selectedTab === "sell" ? "600" : "400",
              }}
              className="text-xs md:text-sm transition-all rounded-lg"
            >
              Sell
            </TabsTrigger>
            <TabsTrigger 
              value="my-offers"
              style={{
                backgroundColor: selectedTab === "my-offers" ? "hsl(var(--accent))" : "transparent",
                color: selectedTab === "my-offers" ? "hsl(var(--accent-foreground))" : "inherit",
                fontWeight: selectedTab === "my-offers" ? "600" : "400",
              }}
              className="text-xs md:text-sm transition-all rounded-lg"
            >
              My Offers
            </TabsTrigger>
            <TabsTrigger 
              value="my-trades"
              style={{
                backgroundColor: selectedTab === "my-trades" ? "hsl(var(--accent))" : "transparent",
                color: selectedTab === "my-trades" ? "hsl(var(--accent-foreground))" : "inherit",
                fontWeight: selectedTab === "my-trades" ? "600" : "400",
              }}
              className="text-xs md:text-sm transition-all rounded-lg"
            >
              My Trades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4 mt-4">
            <Card className="p-3 md:p-4 bg-card">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Filter by country..."
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="w-full md:max-w-xs"
                />

                <Button onClick={fetchOffers} className="w-full md:w-auto">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </Card>

            {isLoading ? (
              <div className="text-center py-8">Loading offers...</div>
            ) : offers.length === 0 ? (
              <Card className="p-8 text-center bg-card">
                <p className="text-muted-foreground">No buy offers available</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {offers.filter(offer => offer && offer.id).map((offer) => (
                  <Card key={offer.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-lg">{offer.users?.ref_code || "Anonymous"}</span>
                          <Badge variant="secondary">{offer.country}</Badge>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-bold text-lg">
                              {formatNum(offer.price_fiat_per_usdt)} {offer.fiat_currency_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-semibold">{formatNum(offer.remaining_amount_usdt)} USDT</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Limits</p>
                            <p className="font-semibold">
                              {formatNum(offer.min_limit_fiat, 0)} - {formatNum(offer.max_limit_fiat, 0)} {offer.fiat_currency_code}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button onClick={() => handleTakeOffer(offer.id)}>
                        Buy USDT
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sell" className="space-y-4">
            <Card className="p-4">
              <div className="flex gap-4">
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Filter by country..."
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="max-w-xs"
                />

                <Button onClick={fetchOffers}>
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </Card>

            {isLoading ? (
              <div className="text-center py-8">Loading offers...</div>
            ) : offers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No sell offers available</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <Card key={offer.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-lg">{offer.users?.ref_code || "Anonymous"}</span>
                          <Badge variant="secondary">{offer.country}</Badge>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-bold text-lg">
                              {formatNum(offer.price_fiat_per_usdt)} {offer.fiat_currency_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-semibold">{formatNum(offer.remaining_amount_usdt)} USDT</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Limits</p>
                            <p className="font-semibold">
                              {formatNum(offer.min_limit_fiat, 0)} - {formatNum(offer.max_limit_fiat, 0)} {offer.fiat_currency_code}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button onClick={() => handleTakeOffer(offer.id)}>
                        Sell USDT
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-offers" className="space-y-4">
            {myOffers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">You haven't created any offers yet</p>
                <Button className="mt-4" onClick={() => setCreateOfferOpen(true)}>
                  Create Your First Offer
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myOffers.map((offer) => (
                  <Card key={offer.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge variant={offer.side === "buy" ? "default" : "secondary"}>
                            {offer.side?.toUpperCase() || "N/A"}
                          </Badge>
                          <Badge variant={offer.is_active ? "outline" : "destructive"}>
                            {offer.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-bold">
                              {formatNum(offer.price_fiat_per_usdt)} {offer.fiat_currency_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available / Total</p>
                            <p className="font-semibold">
                              {formatNum(offer.remaining_amount_usdt)} / {formatNum(offer.total_amount_usdt)} USDT
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Limits</p>
                            <p className="font-semibold">
                              {formatNum(offer.min_limit_fiat, 0)} - {formatNum(offer.max_limit_fiat, 0)}{" "}
                              {offer.fiat_currency_code}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-trades" className="space-y-4">
            {myTrades.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">You haven't made any trades yet</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {myTrades.map((trade) => (
                  <Card key={trade.id} className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/p2p/order/${trade.id}`)}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {getTradeStatusBadge(trade.status)}
                          <Badge variant="outline">{trade.fiat_currency_code}</Badge>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-bold">{formatNum(trade.amount_usdt)} USDT</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-semibold">
                              {formatNum(trade.total_fiat)} {trade.fiat_currency_code}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Created</p>
                            <p className="text-sm">{new Date(trade.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        View Order
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <CreateOfferDialog
          open={createOfferOpen}
          onClose={() => setCreateOfferOpen(false)}
          currencies={currencies}
          paymentMethods={paymentMethods}
          onSuccess={() => {
            fetchMyOffers();
            fetchOffers();
          }}
        />
      </div>
    </Layout>
  );
}

interface CreateOfferDialogProps {
  open: boolean;
  onClose: () => void;
  currencies: FiatCurrency[];
  paymentMethods: PaymentMethod[];
  onSuccess: () => void;
}

function CreateOfferDialog({ open, onClose, currencies, paymentMethods, onSuccess }: CreateOfferDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    side: "sell" as "buy" | "sell",
    total_amount_usdt: 100,
    price_fiat_per_usdt: 0,
    fiat_currency_code: "",
    country: "",
    min_limit_fiat: 10,
    max_limit_fiat: 1000,
    payment_method_ids: [] as string[],
  });

  useEffect(() => {
    if (currencies.length > 0 && !formData.fiat_currency_code) {
      setFormData((prev) => ({
        ...prev,
        fiat_currency_code: currencies[0].code,
        country: currencies[0].country,
        price_fiat_per_usdt: currencies[0].min_price,
      }));
    }
  }, [currencies]);

  const selectedCurrency = currencies.find((c) => c.code === formData.fiat_currency_code);
  const availablePaymentMethods = paymentMethods.filter(
    (pm) => pm.fiat_currency_code === formData.fiat_currency_code
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.payment_method_ids.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one payment method",
        variant: "destructive",
      });
      return;
    }

    if (selectedCurrency) {
      if (
        formData.price_fiat_per_usdt < selectedCurrency.min_price ||
        formData.price_fiat_per_usdt > selectedCurrency.max_price
      ) {
        toast({
          title: "Invalid Price",
          description: `Price must be between ${selectedCurrency.min_price} and ${selectedCurrency.max_price} ${selectedCurrency.code}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsLoading(true);
      const token = tokenManager.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch("/api/p2p/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: "Offer created successfully",
      });

      onSuccess();
      onClose();
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New P2P Offer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Offer Type</label>
              <Select value={formData.side} onValueChange={(value: any) => setFormData({ ...formData, side: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">I want to BUY USDT</SelectItem>
                  <SelectItem value="sell">I want to SELL USDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fiat Currency</label>
              <Select
                value={formData.fiat_currency_code}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    fiat_currency_code: value,
                    country: currencies.find((c) => c.code === value)?.country || "",
                    payment_method_ids: [],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Total Amount (USDT)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.total_amount_usdt}
                onChange={(e) => setFormData({ ...formData, total_amount_usdt: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Price per USDT ({formData.fiat_currency_code})
                {selectedCurrency && (
                  <span className="text-xs text-muted-foreground ml-2">
                    Range: {selectedCurrency.min_price} - {selectedCurrency.max_price}
                  </span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.price_fiat_per_usdt}
                onChange={(e) => setFormData({ ...formData, price_fiat_per_usdt: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Min Limit ({formData.fiat_currency_code})</label>
              <Input
                type="number"
                step="1"
                value={formData.min_limit_fiat}
                onChange={(e) => setFormData({ ...formData, min_limit_fiat: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Max Limit ({formData.fiat_currency_code})</label>
              <Input
                type="number"
                step="1"
                value={formData.max_limit_fiat}
                onChange={(e) => setFormData({ ...formData, max_limit_fiat: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Methods</label>
            {availablePaymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payment methods available for {formData.fiat_currency_code}.{" "}
                <a href="/p2p/payment-methods" className="text-primary hover:underline">
                  Add payment method
                </a>
              </p>
            ) : (
              <div className="space-y-2 border border-border rounded-lg p-3">
                {availablePaymentMethods.map((pm) => (
                  <label key={pm.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.payment_method_ids.includes(pm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            payment_method_ids: [...formData.payment_method_ids, pm.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            payment_method_ids: formData.payment_method_ids.filter((id) => id !== pm.id),
                          });
                        }
                      }}
                    />
                    <span className="text-sm">
                      {pm.provider_name} - {pm.account_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Offer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function P2PWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <P2P />
    </ErrorBoundary>
  );
}
