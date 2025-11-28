import { useState, useEffect } from "react";
import { useToast } from "../../hooks/use-toast";
import { tokenManager } from "../../lib/api";
import { Plus, Edit2, Trash2, Check, X, CreditCard, Smartphone, Globe } from "lucide-react";

interface PaymentProvider {
  id: string;
  fiat_currency_code: string;
  type: "bank" | "mobile_money" | "other";
  provider_name: string;
  is_active: boolean;
  created_at: string;
}

interface FiatCurrency {
  code: string;
  name: string;
  country: string;
}

export default function PaymentMethodsManagement() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [currencies, setCurrencies] = useState<FiatCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<Partial<PaymentProvider>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();

      const [providersRes, currenciesRes] = await Promise.all([
        fetch("/api/p2p/payment-providers/all", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/p2p/fiat/all", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || []);
      }

      if (currenciesRes.ok) {
        const data = await currenciesRes.json();
        setCurrencies(data.currencies || []);
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

  const handleSave = async () => {
    try {
      if (!currentProvider.fiat_currency_code || !currentProvider.type || !currentProvider.provider_name) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const token = tokenManager.getToken();
      const url = editMode
        ? `/api/p2p/payment-providers/${currentProvider.id}`
        : "/api/p2p/payment-providers";
      const method = editMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fiat_currency_code: currentProvider.fiat_currency_code,
          type: currentProvider.type,
          provider_name: currentProvider.provider_name,
          is_active: currentProvider.is_active ?? true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: editMode
            ? "Payment provider updated successfully"
            : "Payment provider created successfully",
        });
        setModalOpen(false);
        setCurrentProvider({});
        fetchData();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save payment provider",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/payment-providers/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Payment provider deleted successfully",
        });
        fetchData();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to delete payment provider",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (provider: PaymentProvider) => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/payment-providers/${provider.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: !provider.is_active,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Provider ${!provider.is_active ? "activated" : "deactivated"}`,
        });
        fetchData();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update provider",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bank":
        return <CreditCard size={18} />;
      case "mobile_money":
        return <Smartphone size={18} />;
      default:
        return <Globe size={18} />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "bank":
        return "Bank Transfer";
      case "mobile_money":
        return "Mobile Money";
      default:
        return "Other";
    }
  };

  // Group providers by currency
  const providersByCurrency = providers.reduce((acc, provider) => {
    if (!acc[provider.fiat_currency_code]) {
      acc[provider.fiat_currency_code] = [];
    }
    acc[provider.fiat_currency_code].push(provider);
    return acc;
  }, {} as Record<string, PaymentProvider[]>);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Payment Methods</h2>
          <p className="text-muted-foreground text-sm">
            Manage approved payment providers per currency
          </p>
        </div>
        <button
          onClick={() => {
            setEditMode(false);
            setCurrentProvider({});
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Provider
        </button>
      </div>

      {/* Provider List by Currency */}
      {loading ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Loading payment providers...</p>
        </div>
      ) : providers.length === 0 ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <CreditCard className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-bold mb-2">No Payment Providers Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add approved payment methods for users to select
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(providersByCurrency).map(([currencyCode, currencyProviders]) => {
            const currency = currencies.find((c) => c.code === currencyCode);
            return (
              <div key={currencyCode} className="card-gradient border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="text-primary" size={24} />
                  <div>
                    <h3 className="text-xl font-bold">{currencyCode}</h3>
                    <p className="text-sm text-muted-foreground">
                      {currency?.country || "Unknown"} • {currencyProviders.length} provider(s)
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {currencyProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between p-4 bg-secondary/50 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${provider.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {getTypeIcon(provider.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{provider.provider_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getTypeName(provider.type)}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            provider.is_active
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {provider.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(provider)}
                          className={`p-2 rounded-lg transition-colors ${
                            provider.is_active
                              ? "bg-primary/20 text-primary hover:bg-primary/30"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          title={provider.is_active ? "Deactivate" : "Activate"}
                        >
                          {provider.is_active ? <Check size={16} /> : <X size={16} />}
                        </button>
                        <button
                          onClick={() => {
                            setEditMode(true);
                            setCurrentProvider(provider);
                            setModalOpen(true);
                          }}
                          className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(provider.id, provider.provider_name)}
                          className="p-2 bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {editMode ? "Edit Payment Provider" : "Add New Payment Provider"}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Currency *
                </label>
                <select
                  value={currentProvider.fiat_currency_code || ""}
                  onChange={(e) =>
                    setCurrentProvider({ ...currentProvider, fiat_currency_code: e.target.value })
                  }
                  disabled={editMode}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">Select currency...</option>
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Type *</label>
                <select
                  value={currentProvider.type || ""}
                  onChange={(e) =>
                    setCurrentProvider({
                      ...currentProvider,
                      type: e.target.value as "bank" | "mobile_money" | "other",
                    })
                  }
                  disabled={editMode}
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">Select type...</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Provider Name *
                </label>
                <input
                  type="text"
                  value={currentProvider.provider_name || ""}
                  onChange={(e) =>
                    setCurrentProvider({ ...currentProvider, provider_name: e.target.value })
                  }
                  placeholder="e.g., Commercial Bank of Ethiopia, M-Pesa"
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active_provider"
                  checked={currentProvider.is_active ?? true}
                  onChange={(e) =>
                    setCurrentProvider({ ...currentProvider, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-border"
                />
                <label htmlFor="is_active_provider" className="text-sm font-medium cursor-pointer">
                  Active (users can select this provider)
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setCurrentProvider({});
                }}
                className="flex-1 px-4 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editMode ? "Update Provider" : "Create Provider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
