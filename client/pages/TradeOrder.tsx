import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Send, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";

interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  amount_usdt: number;
  price_fiat_per_usdt: number;
  total_fiat: number;
  fiat_currency_code: string;
  status: string;
  escrow_amount_usdt: number;
  payment_deadline: string;
  payment_receipt_url?: string;
  buyer: { id: string; email: string; ref_code: string };
  seller: { id: string; email: string; ref_code: string };
  buyer_payment_method_id?: string;
  seller_payment_method_id?: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  message?: string;
  attachment_url?: string;
  created_at: string;
  sender: { id: string; email: string; ref_code: string };
}

interface PaymentMethod {
  id: string;
  provider_name: string;
  account_name: string;
  account_number: string;
}

export default function TradeOrder() {
  const { tradeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [buyerPaymentMethod, setBuyerPaymentMethod] = useState<PaymentMethod | null>(null);
  const [sellerPaymentMethod, setSellerPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    fetchTrade();
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll for new messages
    return () => clearInterval(interval);
  }, [tradeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchTrade = async () => {
    const token = tokenManager.getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch(`/api/p2p/trades/${tradeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setTrade(data.trade);
        setCurrentUserId(data.trade.buyer_id); // Will be updated when we decode token properly
        
        // Fetch payment methods
        if (data.trade.buyer_payment_method_id) {
          fetchPaymentMethod(data.trade.buyer_payment_method_id, "buyer");
        }
        if (data.trade.seller_payment_method_id) {
          fetchPaymentMethod(data.trade.seller_payment_method_id, "seller");
        }
      } else {
        toast({
          title: "Error",
          description: "Trade not found",
          variant: "destructive",
        });
        navigate("/p2p");
      }
    } catch (error) {
      console.error("Failed to fetch trade:", error);
    }
  };

  const fetchPaymentMethod = async (methodId: string, type: "buyer" | "seller") => {
    const token = tokenManager.getToken();
    try {
      const response = await fetch(`/api/p2p/payment-methods/${methodId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        if (type === "buyer") {
          setBuyerPaymentMethod(data.payment_method);
        } else {
          setSellerPaymentMethod(data.payment_method);
        }
      }
    } catch (error) {
      console.error("Failed to fetch payment method:", error);
    }
  };

  const fetchMessages = async () => {
    const token = tokenManager.getToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/p2p/chat/${tradeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const token = tokenManager.getToken();
    try {
      const response = await fetch(`/api/p2p/chat/${tradeId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        setNewMessage("");
        fetchMessages();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleMarkPaid = async () => {
    setIsLoading(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/trades/${tradeId}/payment-sent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_receipt_url: receiptUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: "Payment marked as sent",
      });
      fetchTrade();
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

  const handleRelease = async () => {
    if (!confirm("Are you sure you want to release USDT to the buyer?")) return;

    setIsLoading(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/trades/${tradeId}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: "USDT released successfully",
      });
      fetchTrade();
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

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this trade?")) return;

    setIsLoading(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/trades/${tradeId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Success",
        description: "Trade cancelled",
      });
      fetchTrade();
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

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the dispute",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/trades/${tradeId}/dispute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dispute_reason: disputeReason }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({
        title: "Dispute Opened",
        description: "An administrator will review your dispute",
      });
      setDisputeOpen(false);
      fetchTrade();
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

  if (!trade) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto p-6">
          <div className="text-center py-8">Loading trade...</div>
        </div>
      </Layout>
    );
  }

  const isBuyer = trade.buyer_id === currentUserId;
  const timeRemaining = new Date(trade.payment_deadline).getTime() - new Date().getTime();
  const minutesRemaining = Math.max(0, Math.floor(timeRemaining / 60000));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/p2p")}>
            ← Back to P2P
          </Button>
          <Badge variant={trade.status === "released" ? "default" : "outline"}>
            {trade.status.toUpperCase().replace("_", " ")}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - Trade Info */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Trade Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">{(parseFloat(String(trade.amount_usdt)) || 0).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span>{(parseFloat(String(trade.price_fiat_per_usdt)) || 0).toFixed(2)} {trade.fiat_currency_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">{(parseFloat(String(trade.total_fiat)) || 0).toFixed(2)} {trade.fiat_currency_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buyer</span>
                  <span>{trade.buyer.ref_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seller</span>
                  <span>{trade.seller.ref_code}</span>
                </div>
              </div>
            </Card>

            {trade.status === "pending" && (
              <Card className="p-6 bg-yellow-500/10 border-yellow-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-semibold">Payment Window</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Time remaining: <span className="font-bold text-yellow-500">{minutesRemaining} minutes</span>
                </p>
              </Card>
            )}

            {sellerPaymentMethod && (
              <Card className="p-6">
                <h3 className="font-semibold mb-3">Seller Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{sellerPaymentMethod.provider_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Name</span>
                    <span className="font-medium">{sellerPaymentMethod.account_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="font-mono">{sellerPaymentMethod.account_number}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <Card className="p-6 space-y-3">
              {trade.status === "pending" && isBuyer && (
                <>
                  <Input
                    placeholder="Receipt URL (optional)"
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                  />
                  <Button className="w-full" onClick={handleMarkPaid} disabled={isLoading}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    I've Made Payment
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={isLoading}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Trade
                  </Button>
                </>
              )}

              {trade.status === "payment_sent" && !isBuyer && (
                <>
                  <Button className="w-full" onClick={handleRelease} disabled={isLoading}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Release USDT
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => setDisputeOpen(true)}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Open Dispute
                  </Button>
                </>
              )}

              {trade.status === "payment_sent" && isBuyer && (
                <div className="text-center text-sm text-muted-foreground">
                  Waiting for seller to release USDT...
                </div>
              )}

              {trade.status === "released" && (
                <div className="text-center text-green-500 font-semibold">
                  ✓ Trade Completed Successfully
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Chat */}
          <Card className="p-6 flex flex-col h-[600px]">
            <h2 className="text-xl font-bold mb-4">Chat</h2>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.sender_id === currentUserId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-xs opacity-70 mb-1">{msg.sender.ref_code}</p>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open Dispute</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Describe the issue in detail..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={6}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDisputeOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDispute} disabled={isLoading}>
                  Submit Dispute
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
