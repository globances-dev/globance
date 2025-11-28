import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";
import { useNavigate } from "react-router-dom";

interface FiatCurrency {
  code: string;
  name: string;
  country: string;
}

interface PaymentMethod {
  id: string;
  fiat_currency_code: string;
  type: string;
  provider_name: string;
  account_name: string;
  account_number: string;
  is_active: boolean;
}

export default function PaymentMethods() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [currencies, setCurrencies] = useState<FiatCurrency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    fetchCurrencies();
    fetchPaymentMethods();
  }, []);

  const fetchCurrencies = async () => {
    try {
      const response = await fetch("/api/p2p/fiat");
      const data = await response.json();
      if (response.ok) {
        setCurrencies(data.currencies || []);
      }
    } catch (error) {
      console.error("Failed to fetch currencies:", error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      setIsLoading(true);
      const token = tokenManager.getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("/api/p2p/payment-methods", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setMethods(data.payment_methods || []);
      }
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment method?")) return;

    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/payment-methods/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Payment method deleted",
        });
        fetchPaymentMethods();
      } else {
        const data = await response.json();
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="space-y-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold">Payment Methods</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your payment methods for P2P trading</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Button variant="outline" onClick={() => navigate("/p2p")} className="w-full sm:w-auto">
              Back to P2P
            </Button>
            <Button
              onClick={() => {
                setEditingMethod(null);
                setDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : methods.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">You haven't added any payment methods yet</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Payment Method
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {methods.map((method) => (
              <Card key={method.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{method.provider_name}</h3>
                      <span className="text-sm px-2 py-1 bg-secondary rounded">{method.fiat_currency_code}</span>
                      <span className="text-sm px-2 py-1 bg-muted rounded capitalize">{method.type.replace("_", " ")}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Account Name: <span className="font-medium text-foreground">{method.account_name}</span></p>
                      <p>Account Number: <span className="font-medium text-foreground">{method.account_number}</span></p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingMethod(method);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(method.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <PaymentMethodDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditingMethod(null);
          }}
          currencies={currencies}
          editingMethod={editingMethod}
          onSuccess={fetchPaymentMethods}
        />
      </div>
    </Layout>
  );
}

interface PaymentMethodDialogProps {
  open: boolean;
  onClose: () => void;
  currencies: FiatCurrency[];
  editingMethod: PaymentMethod | null;
  onSuccess: () => void;
}

function PaymentMethodDialog({ open, onClose, currencies, editingMethod, onSuccess }: PaymentMethodDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fiat_currency_code: "",
    type: "bank" as "bank" | "mobile_money",
    provider_name: "",
    account_name: "",
    account_number: "",
  });

  useEffect(() => {
    if (editingMethod) {
      setFormData({
        fiat_currency_code: editingMethod.fiat_currency_code,
        type: editingMethod.type as "bank" | "mobile_money",
        provider_name: editingMethod.provider_name,
        account_name: editingMethod.account_name,
        account_number: editingMethod.account_number,
      });
    } else {
      setFormData({
        fiat_currency_code: currencies[0]?.code || "",
        type: "bank",
        provider_name: "",
        account_name: "",
        account_number: "",
      });
    }
  }, [editingMethod, currencies, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      const token = tokenManager.getToken();
      if (!token) throw new Error("Not authenticated");

      const url = editingMethod
        ? `/api/p2p/payment-methods/${editingMethod.id}`
        : "/api/p2p/payment-methods";

      const response = await fetch(url, {
        method: editingMethod ? "PUT" : "POST",
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
        description: editingMethod ? "Payment method updated" : "Payment method added",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingMethod ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Fiat Currency</label>
            <Select
              value={formData.fiat_currency_code}
              onValueChange={(value) => setFormData({ ...formData, fiat_currency_code: value })}
              disabled={!!editingMethod}
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

          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Provider Name</label>
            <Input
              placeholder="e.g., Commercial Bank of Ethiopia, M-Pesa"
              value={formData.provider_name}
              onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Account Name</label>
            <Input
              placeholder="Full name as registered"
              value={formData.account_name}
              onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Account Number</label>
            <Input
              placeholder="Account number or phone number"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : editingMethod ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
