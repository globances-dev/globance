import { Router } from "express";
import fiatRoutes from "./fiat";
import paymentMethodRoutes from "./payment-methods";
import paymentProvidersRoutes from "./payment-providers";
import p2pOffersRoutes from "./p2p-offers";
import p2pTradesRoutes from "./p2p-trades";
import p2pChatRoutes from "./p2p-chat";
import p2pAdminStatsRoutes from "./p2p-admin-stats";

const router = Router();

// Fiat currency management
router.use("/fiat", fiatRoutes);

// User payment methods
router.use("/payment-methods", paymentMethodRoutes);

// Approved payment providers (admin-managed)
router.use("/payment-providers", paymentProvidersRoutes);

// P2P offers (buy/sell)
router.use("/offers", p2pOffersRoutes);

// P2P trades (take offer, escrow, release, dispute)
router.use("/trades", p2pTradesRoutes);

// P2P chat (in-order messaging)
router.use("/chat", p2pChatRoutes);

// Admin statistics (marketplace-wide)
router.use("/admin/stats", p2pAdminStatsRoutes);

export default router;
