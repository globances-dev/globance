import { useState, useEffect } from "react";
import { useToast } from "../../hooks/use-toast";
import { tokenManager } from "../../lib/api";
import { Plus, Edit2, Trash2, Check, X, Globe, DollarSign } from "lucide-react";

interface FiatCurrency {
  id: string;
  code: string;
  name: string;
  country: string;
  min_price: number;
  max_price: number;
  is_active: boolean;
  created_at: string;
}

export default function FiatCurrencyManagement() {
  const { toast } = useToast();
  const [currencies, setCurrencies] = useState<FiatCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<Partial<FiatCurrency>>({});

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();
      const response = await fetch("/api/p2p/fiat/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrencies(data.currencies || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load currencies",
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

  const handleSave = async () => {
    try {
      if (!currentCurrency.code || !currentCurrency.name || !currentCurrency.country) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      if (currentCurrency.min_price! >= currentCurrency.max_price!) {
        toast({
          title: "Error",
          description: "Min price must be less than max price",
          variant: "destructive",
        });
        return;
      }

      const token = tokenManager.getToken();
      const url = editMode
        ? `/api/p2p/fiat/${currentCurrency.code}`
        : "/api/p2p/fiat";
      const method = editMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: currentCurrency.code?.toUpperCase(),
          name: currentCurrency.name,
          country: currentCurrency.country,
          min_price: currentCurrency.min_price,
          max_price: currentCurrency.max_price,
          is_active: currentCurrency.is_active ?? true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: editMode
            ? "Currency updated successfully"
            : "Currency created successfully",
        });
        setModalOpen(false);
        setCurrentCurrency({});
        fetchCurrencies();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save currency",
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

  const handleDelete = async (code: string) => {
    if (!confirm(`Are you sure you want to delete ${code}? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/fiat/${code}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Currency deleted successfully",
        });
        fetchCurrencies();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to delete currency",
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

  const handleToggleActive = async (currency: FiatCurrency) => {
    try {
      const token = tokenManager.getToken();
      const response = await fetch(`/api/p2p/fiat/${currency.code}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: !currency.is_active,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Currency ${!currency.is_active ? "activated" : "deactivated"}`,
        });
        fetchCurrencies();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update currency",
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Fiat Currencies</h2>
          <p className="text-muted-foreground text-sm">
            Manage supported fiat currencies and price ranges
          </p>
        </div>
        <button
          onClick={() => {
            setEditMode(false);
            setCurrentCurrency({});
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Currency
        </button>
      </div>

      {/* Currency List */}
      {loading ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Loading currencies...</p>
        </div>
      ) : currencies.length === 0 ? (
        <div className="card-gradient border border-border rounded-lg p-8 text-center">
          <Globe className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-xl font-bold mb-2">No Currencies Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your first fiat currency to enable P2P trading
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {currencies.map((currency) => (
            <div
              key={currency.id}
              className="card-gradient border border-border rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{currency.code}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        currency.is_active
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currency.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Currency Name</p>
                      <p className="font-medium">{currency.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Country</p>
                      <p className="font-medium">{currency.country}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Price Range (per 1 USDT)</p>
                      <p className="font-medium">
                        {currency.min_price} - {currency.max_price} {currency.code}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(currency)}
                    className={`p-2 rounded-lg transition-colors ${
                      currency.is_active
                        ? "bg-primary/20 text-primary hover:bg-primary/30"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    title={currency.is_active ? "Deactivate" : "Activate"}
                  >
                    {currency.is_active ? <Check size={18} /> : <X size={18} />}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(true);
                      setCurrentCurrency(currency);
                      setModalOpen(true);
                    }}
                    className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(currency.code)}
                    className="p-2 bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {editMode ? "Edit Currency" : "Add New Currency"}
            </h2>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Currency Code *
                  </label>
                  <input
                    type="text"
                    value={currentCurrency.code || ""}
                    onChange={(e) =>
                      setCurrentCurrency({ ...currentCurrency, code: e.target.value.toUpperCase() })
                    }
                    placeholder="ETB, NGN, KES"
                    maxLength={10}
                    disabled={editMode}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Currency Name *
                  </label>
                  <input
                    type="text"
                    value={currentCurrency.name || ""}
                    onChange={(e) =>
                      setCurrentCurrency({ ...currentCurrency, name: e.target.value })
                    }
                    placeholder="Ethiopian Birr"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Country *</label>
                <input
                  type="text"
                  value={currentCurrency.country || ""}
                  onChange={(e) =>
                    setCurrentCurrency({ ...currentCurrency, country: e.target.value })
                  }
                  placeholder="Ethiopia"
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Min Price (per 1 USDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentCurrency.min_price || ""}
                    onChange={(e) =>
                      setCurrentCurrency({
                        ...currentCurrency,
                        min_price: parseFloat(e.target.value),
                      })
                    }
                    placeholder="170.00"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Max Price (per 1 USDT) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentCurrency.max_price || ""}
                    onChange={(e) =>
                      setCurrentCurrency({
                        ...currentCurrency,
                        max_price: parseFloat(e.target.value),
                      })
                    }
                    placeholder="180.00"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={currentCurrency.is_active ?? true}
                  onChange={(e) =>
                    setCurrentCurrency({ ...currentCurrency, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-border"
                />
                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                  Active (users can trade with this currency)
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setCurrentCurrency({});
                }}
                className="flex-1 px-4 py-3 bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {editMode ? "Update Currency" : "Create Currency"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
