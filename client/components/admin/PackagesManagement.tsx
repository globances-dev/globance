import { useState, useEffect } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tokenManager } from "@/lib/api";

interface Package {
  id: string;
  name: string;
  min_investment: number;
  daily_percentage: number;
  duration_days: number;
  referral_required: number;
}

export default function PackagesManagement() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Package>>({});

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch("/api/packages");
      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (error) {
      console.error("Failed to fetch packages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setEditForm(pkg);
  };

  const handleSave = async () => {
    console.log("handleSave called", { editingId, editForm });
    
    const token = tokenManager.getToken();
    console.log("Token check:", token ? "Token exists" : "No token");
    
    if (!token) {
      toast({ title: "Error", description: "Not authenticated. Please log in again.", variant: "destructive" });
      return;
    }
    if (!editingId) {
      toast({ title: "Error", description: "No package selected for editing.", variant: "destructive" });
      return;
    }

    setSaving(true);
    console.log("Making API request to:", `/api/admin/packages/${editingId}`);
    try {
      const response = await fetch(`/api/admin/packages/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Package updated successfully" });
        setEditingId(null);
        fetchPackages();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({ 
          title: "Error", 
          description: errorData.error || `Failed to update package (${response.status})`, 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error("Save package error:", error);
      toast({ title: "Error", description: error.message || "Failed to update package", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading packages...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Mining Packages</h2>
        <p className="text-muted-foreground mb-6">Configure and manage cloud mining packages</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <div key={pkg.id} className="border border-border rounded-lg p-4 bg-secondary/50">
            {editingId === pkg.id ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <input
                    type="text"
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Min Investment (USDT)</label>
                  <input
                    type="number"
                    value={editForm.min_investment || ""}
                    onChange={(e) => setEditForm({ ...editForm, min_investment: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Daily Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.daily_percentage || ""}
                    onChange={(e) => setEditForm({ ...editForm, daily_percentage: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duration (days)</label>
                  <input
                    type="number"
                    value={editForm.duration_days || ""}
                    onChange={(e) => setEditForm({ ...editForm, duration_days: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Referrals Required</label>
                  <input
                    type="number"
                    value={editForm.referral_required ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, referral_required: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSave();
                    }}
                    disabled={saving}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                    className="flex-1 px-3 py-2 bg-secondary border border-border rounded text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-lg mb-2">{pkg.name}</h3>
                <div className="space-y-1 text-sm text-muted-foreground mb-4">
                  <p>Min: {parseFloat(String(pkg.min_investment)) || 0} USDT</p>
                  <p>Daily: {parseFloat(String(pkg.daily_percentage)) || 0}%</p>
                  <p>Duration: {pkg.duration_days} days</p>
                  <p>Referrals Required: {pkg.referral_required || 0}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(pkg)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500/20 text-blue-500 rounded text-sm hover:bg-blue-500/30"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
