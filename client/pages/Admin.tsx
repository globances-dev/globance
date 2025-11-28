import Layout from "@/components/Layout";
import { BarChart, Users, DollarSign, Settings, AlertCircle, ChevronRight, MessageCircle, Send, Save, ArrowLeft, Globe, CreditCard, TrendingUp, TrendingDown, Clock, Database } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
import { tokenManager } from "../lib/api";
import FiatCurrencyManagement from "../components/admin/FiatCurrencyManagement";
import PaymentMethodsManagement from "../components/admin/PaymentMethodsManagement";
import DisputeResolution from "../components/admin/DisputeResolution";
import P2POverview from "../components/admin/P2POverview";
import DepositMonitoring from "../components/admin/DepositMonitoring";
import WithdrawalMonitoring from "../components/admin/WithdrawalMonitoring";
import MiningMonitoring from "../components/admin/MiningMonitoring";
import AdminOverviewStats from "../components/admin/AdminOverviewStats";
import WithdrawalAdminManagement from "../components/admin/WithdrawalAdminManagement";
import CronMonitoring from "../components/admin/CronMonitoring";
import UserManagement from "../components/admin/UserManagement";
import PackagesManagement from "../components/admin/PackagesManagement";
import SystemLogs from "../components/admin/SystemLogs";
import SupportSettings from "../components/admin/SupportSettings";
import DatabaseBrowser from "../components/admin/DatabaseBrowser";

interface Setting {
  key: string;
  value: string;
}

type AdminSection = 'overview' | 'users' | 'withdrawals' | 'packages' | 'deposits' | 'mining' | 'logs' | 'support' | 'p2p-overview' | 'p2p-fiat' | 'p2p-payment-methods' | 'p2p-disputes' | 'withdrawal-admin' | 'cron-monitoring' | 'database';

export default function Admin() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [telegramLink, setTelegramLink] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settingsModalOpen) {
      fetchSettings();
    }
  }, [settingsModalOpen]);

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
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();

      if (!token) {
        toast({
          title: "Error",
          description: "You must be logged in as admin",
          variant: "destructive",
        });
        return;
      }

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

      if (response.ok) {
        toast({
          title: "Success",
          description: "Customer support settings updated successfully",
        });
        setSettingsModalOpen(false);
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update settings",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage users, finances, mining packages, and deposits
        </p>
      </div>

      <AdminOverviewStats />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => setActiveSection('users')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="text-primary" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">User Management</h3>
          <p className="text-xs text-muted-foreground mt-2">View, freeze, or promote users</p>
        </div>

        <div
          onClick={() => setActiveSection('deposits')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <TrendingDown className="text-blue-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Deposits</h3>
          <p className="text-xs text-muted-foreground mt-2">Monitor deposit transactions</p>
        </div>

        <div
          onClick={() => setActiveSection('withdrawals')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="text-green-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Withdrawals</h3>
          <p className="text-xs text-muted-foreground mt-2">Manage withdrawal requests</p>
        </div>

        <div
          onClick={() => setActiveSection('mining')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="text-green-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Mining Purchases</h3>
          <p className="text-xs text-muted-foreground mt-2">Monitor user mining packages</p>
        </div>

        <div
          onClick={() => setActiveSection('packages')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart className="text-accent" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Packages</h3>
          <p className="text-xs text-muted-foreground mt-2">Configure mining packages</p>
        </div>

        <div
          onClick={() => setActiveSection('logs')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart className="text-purple-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">System Logs</h3>
          <p className="text-xs text-muted-foreground mt-2">View cron and audit logs</p>
        </div>

        <div
          onClick={() => setActiveSection('support')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <MessageCircle className="text-orange-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Support Settings</h3>
          <p className="text-xs text-muted-foreground mt-2">Configure customer support links</p>
        </div>

        <div
          onClick={() => setActiveSection('cron-monitoring')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <Clock className="text-purple-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Cron Monitoring</h3>
          <p className="text-xs text-muted-foreground mt-2">Monitor automated operations</p>
        </div>

        <div
          onClick={() => setActiveSection('database')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <Database className="text-cyan-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Production Database</h3>
          <p className="text-xs text-muted-foreground mt-2">View and edit production data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div
          onClick={() => setActiveSection('p2p-overview')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <Globe className="text-blue-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">P2P Overview</h3>
          <p className="text-xs text-muted-foreground mt-2">Marketplace statistics</p>
        </div>

        <div
          onClick={() => setActiveSection('p2p-fiat')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <CreditCard className="text-green-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Fiat Currencies</h3>
          <p className="text-xs text-muted-foreground mt-2">Manage supported currencies</p>
        </div>

        <div
          onClick={() => setActiveSection('p2p-disputes')}
          className="card-gradient border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <AlertCircle className="text-red-500" size={24} />
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Disputes</h3>
          <p className="text-xs text-muted-foreground mt-2">Resolve trade disputes</p>
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'users':
        return <UserManagement />;
      case 'deposits':
        return <DepositMonitoring />;
      case 'withdrawals':
        return <WithdrawalAdminManagement />;
      case 'mining':
        return <MiningMonitoring />;
      case 'packages':
        return <PackagesManagement />;
      case 'logs':
        return <SystemLogs />;
      case 'support':
        return <SupportSettings />;
      case 'p2p-overview':
        return <P2POverview />;
      case 'p2p-fiat':
        return <FiatCurrencyManagement />;
      case 'p2p-payment-methods':
        return <PaymentMethodsManagement />;
      case 'p2p-disputes':
        return <DisputeResolution />;
      case 'cron-monitoring':
        return <CronMonitoring />;
      case 'database':
        return <DatabaseBrowser />;
      default:
        return (
          <div className="text-center py-12">
            <p className="text-muted-foreground">This section is under development</p>
            <button
              onClick={() => setActiveSection('overview')}
              className="mt-4 text-primary hover:underline"
            >
              ← Back to Overview
            </button>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeSection !== 'overview' && (
          <button
            onClick={() => setActiveSection('overview')}
            className="mb-6 text-sm text-primary hover:underline flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Overview
          </button>
        )}
        {renderContent()}
      </div>
    </Layout>
  );
}
