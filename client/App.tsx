import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import useMobileBackHandler from "./hooks/useMobileBackHandler";
import ErrorBoundary from "./components/ErrorBoundary";
import { KeyboardToolbar } from "./components/KeyboardToolbar";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Mining from "./pages/Mining";
import Profile from "./pages/Profile";
import Packages from "./pages/Packages";
import P2P from "./pages/P2P";
import Wallet from "./pages/Wallet";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import Referral from "./pages/Referral";
import CustomerSupport from "./pages/CustomerSupport";
import PaymentMethods from "./pages/PaymentMethods";
import TradeOffer from "./pages/TradeOffer";
import TradeOrder from "./pages/TradeOrder";

const queryClient = new QueryClient();

const AppRoutes = () => {
  useMobileBackHandler();

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/home" element={<Home />} />
      <Route path="/mining" element={<Mining />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/packages" element={<Packages />} />
      <Route path="/p2p" element={<P2P />} />
      <Route path="/p2p/payment-methods" element={<PaymentMethods />} />
      <Route path="/p2p/trade/:offerId" element={<TradeOffer />} />
      <Route path="/p2p/order/:tradeId" element={<TradeOrder />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/referral" element={<Referral />} />
      <Route path="/customer-support" element={<CustomerSupport />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin" element={<Admin />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <KeyboardToolbar />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
