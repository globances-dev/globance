import Layout from "@/components/Layout";
import { MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";

interface Setting {
  key: string;
  value: string;
}

export default function CustomerSupport() {
  const [telegramLink, setTelegramLink] = useState<string>("");
  const [whatsappLink, setWhatsappLink] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings/category/customer_support");
      if (response.ok) {
        const data = await response.json();
        const settings: Setting[] = data.settings || [];
        
        const telegram = settings.find(s => s.key === "telegram_support_link");
        const whatsapp = settings.find(s => s.key === "whatsapp_support_link");
        
        setTelegramLink(telegram?.value || "");
        setWhatsappLink(whatsapp?.value || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Customer Support</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Need help? Contact our support team directly through your preferred platform
          </p>
        </div>

        {/* Support Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Telegram */}
          {telegramLink && (
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group card-gradient border-2 border-[#0088cc] hover:border-[#0088cc]/80 rounded-2xl p-12 transition-all hover:shadow-xl hover:shadow-[#0088cc]/20 hover:scale-105"
            >
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-[#0088cc] rounded-full flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-[#0088cc]/50 transition-all">
                <Send className="text-white" size={48} />
              </div>
              <h2 className="text-3xl font-bold mb-3">Contact on Telegram</h2>
              <p className="text-muted-foreground mb-6">
                Get instant support via Telegram messenger
              </p>
              <div className="inline-flex items-center gap-2 px-8 py-4 bg-[#0088cc] text-white font-bold text-lg rounded-lg group-hover:bg-[#0088cc]/90 transition-colors">
                <Send size={20} />
                Open Telegram
              </div>
            </div>
          </a>

          )}

          {/* WhatsApp */}
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group card-gradient border-2 border-[#25D366] hover:border-[#25D366]/80 rounded-2xl p-12 transition-all hover:shadow-xl hover:shadow-[#25D366]/20 hover:scale-105"
            >
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-[#25D366] rounded-full flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-[#25D366]/50 transition-all">
                <MessageCircle className="text-white" size={48} />
              </div>
              <h2 className="text-3xl font-bold mb-3">Contact on WhatsApp</h2>
              <p className="text-muted-foreground mb-6">
                Chat with us directly on WhatsApp
              </p>
              <div className="inline-flex items-center gap-2 px-8 py-4 bg-[#25D366] text-white font-bold text-lg rounded-lg group-hover:bg-[#25D366]/90 transition-colors">
                <MessageCircle size={20} />
                Open WhatsApp
              </div>
            </div>
          </a>
          )}
        </div>

        {/* Show message if no contact links are configured */}
        {!telegramLink && !whatsappLink && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-2">
              Support contact information is being configured.
            </p>
            <p className="text-sm text-muted-foreground">
              Please check back later or contact us via email.
            </p>
          </div>
        )}

        {/* Additional Info */}
        {(telegramLink || whatsappLink) && (
          <div className="card-gradient border border-border rounded-lg p-8 text-center">
            <h3 className="text-xl font-bold mb-4">Support Hours</h3>
            <p className="text-muted-foreground mb-2">
              Our support team is available 24/7 to assist you
            </p>
            <p className="text-sm text-muted-foreground">
              Average response time: Less than 1 hour
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
