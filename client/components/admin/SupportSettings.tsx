import { useState, useEffect } from "react";
import { Save, LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tokenManager } from "@/lib/api";

export default function SupportSettings() {
  const { toast } = useToast();
  const [telegramLink, setTelegramLink] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings/category/customer_support");
      if (response.ok) {
        const data = await response.json();
        const settings = data.settings || [];
        
        const telegram = settings.find((s: any) => s.key === "telegram_support_link");
        const whatsapp = settings.find((s: any) => s.key === "whatsapp_support_link");
        
        setTelegramLink(telegram?.value || "");
        setWhatsappLink(whatsapp?.value || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = tokenManager.getToken();

      if (!token) {
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      console.log("📤 Saving support settings:", { telegramLink, whatsappLink });

      const response = await fetch("/api/settings/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: [
            { key: "telegram_support_link", value: telegramLink },
            { key: "whatsapp_support_link", value: whatsappLink },
          ],
        }),
      });

      console.log("📥 Response status:", response.status);
      const data = await response.json();
      console.log("📥 Response data:", data);

      if (response.ok) {
        console.log("✅ Settings saved successfully");
        toast({ title: "Success", description: "Support settings updated successfully" });
        // Refresh settings to confirm they were saved
        setTimeout(fetchSettings, 500);
      } else {
        console.error("❌ Save failed:", data);
        toast({ title: "Error", description: data.error || "Failed to update settings", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("❌ Exception:", error);
      toast({ title: "Error", description: error.message || "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">Support Settings</h2>
        <p className="text-muted-foreground mb-6">Configure customer support links and channels</p>
      </div>

      <div className="space-y-6 border border-border rounded-lg p-6">
        <div>
          <label className="block text-sm font-semibold mb-2">Telegram Support Link</label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
            <input
              type="url"
              value={telegramLink}
              onChange={(e) => setTelegramLink(e.target.value)}
              placeholder="https://t.me/your-support-group"
              className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Link to your Telegram support group or channel
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">WhatsApp Support Link</label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-3 text-muted-foreground" size={18} />
            <input
              type="url"
              value={whatsappLink}
              onChange={(e) => setWhatsappLink(e.target.value)}
              placeholder="https://wa.me/1234567890"
              className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Link to your WhatsApp support number or group
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-500">
            ℹ️ These links will be displayed to users in the Customer Support page. Make sure they are valid and active.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-semibold"
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
