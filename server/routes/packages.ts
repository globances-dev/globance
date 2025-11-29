import { Router, Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";
import { z } from "zod";
import {
  checkPackageEligibility,
  updateUserRank,
  recordReferralBonus,
  recordEarningsTransaction,
  getUplineUsers,
  PACKAGES_CONFIG,
  getUserRankInfo,
} from "../utils/referral";

const router = Router();

// Middleware
const authMiddleware = (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  console.log("[AUTH] Package route called, token present:", !!token);
  
  if (!token) {
    console.log("[AUTH] No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);
  console.log("[AUTH] Token decoded:", !!decoded);
  
  if (!decoded) {
    console.log("[AUTH] Invalid token");
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = decoded;
  console.log("[AUTH] User authenticated:", decoded.id);
  next();
};

// Get all packages
router.get("/", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .order("id");

    if (error) {
      throw error;
    }

    res.json({
      packages: data || [],
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get package details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ package: data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Buy package
router.post("/buy", authMiddleware, async (req: any, res: Response) => {
  try {
    console.log("[BUY_PACKAGE] Starting purchase flow");
    
    const { package_id, amount } = z
      .object({
        package_id: z.union([z.string(), z.number()]).transform(v => String(v)),
        amount: z.number().optional(),
      })
      .parse(req.body);

    console.log(`[BUY_PACKAGE] User: ${req.user.id}, Package: ${package_id}, Amount: ${amount}`);

    // Find package config
    const pkgConfig = PACKAGES_CONFIG.find((p) => p.id === package_id);
    if (!pkgConfig) {
      console.log(`[BUY_PACKAGE] Package config not found: ${package_id}`);
      return res.status(404).json({ error: "Package not found" });
    }

    // Use provided amount or minimum
    const investmentAmount = amount || pkgConfig.min_invest;
    console.log(`[BUY_PACKAGE] Investment amount: ${investmentAmount}, Duration: ${pkgConfig.duration_days} days`);

    // Validate minimum investment
    if (investmentAmount < pkgConfig.min_invest) {
      console.log(`[BUY_PACKAGE] Amount below minimum: ${investmentAmount} < ${pkgConfig.min_invest}`);
      return res.status(400).json({ error: `Minimum investment is ${pkgConfig.min_invest} USDT` });
    }

    // Check referral requirements for non-Bronze packages
    if (pkgConfig.referral_required > 0) {
      const eligibility = await checkPackageEligibility(req.user.id, String(package_id));
      if (!eligibility.eligible) {
        console.log(`[BUY_PACKAGE] Eligibility check failed: ${eligibility.reason}`);
        return res.status(400).json({
          error: eligibility.reason || `You need ${pkgConfig.referral_required} active referrals to buy this package` 
        });
      }
    }

    // Get user wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("usdt_balance")
      .eq("user_id", req.user.id)
      .single();

    if (walletError || !wallet) {
      return res.status(400).json({ error: "Wallet not found" });
    }

    if (wallet.usdt_balance < investmentAmount) {
      console.log(`[BUY_PACKAGE] Insufficient balance: ${wallet.usdt_balance} < ${investmentAmount}`);
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Create purchase
    const now = new Date().toISOString();
    const endTime = new Date(
      Date.now() + pkgConfig.duration_days * 86400000,
    ).toISOString();

    console.log(`[BUY_PACKAGE] Attempting insert with data:`, {
      user_id: req.user.id,
      package_id,
      amount: investmentAmount,
      start_time: now,
      end_time: endTime,
      status: "active",
    });

    let purchaseId: string = "";
    try {
      const { data: purchase, error: insertError } = await supabase
        .from("purchases")
        .insert([
          {
            user_id: req.user.id,
            package_id,
            amount: investmentAmount,
            status: "active",
            start_time: now,
            end_time: endTime,
            created_at: now,
          },
        ])
        .select("id")
        .single();

      if (insertError || !purchase) {
        throw insertError || new Error("Insert returned no data");
      }

      purchaseId = purchase.id;
      console.log(`[BUY_PACKAGE] ✓ Purchase created with ID: ${purchaseId}`);
    } catch (insertError: any) {
      console.error("[BUY_PACKAGE] Insert exception:", insertError);
      return res.status(400).json({ error: `Insert failed: ${insertError.message}` });
    }

    // Deduct from wallet
    console.log("[BUY_PACKAGE] Deducting from wallet:", investmentAmount);
    await supabase
      .from("wallets")
      .update({ usdt_balance: wallet.usdt_balance - investmentAmount })
      .eq("user_id", req.user.id);
    console.log("[BUY_PACKAGE] ✓ Wallet updated");

    // Get upline users and process one-time purchase bonuses
    const upline = await getUplineUsers(req.user.id);

    if (upline.level1) {
      const level1Bonus = (investmentAmount * 10) / 100;
      const { data: level1Wallet } = await supabase
        .from("wallets")
        .select("usdt_balance")
        .eq("user_id", upline.level1)
        .single();

      if (level1Wallet) {
        await supabase
          .from("wallets")
          .update({ usdt_balance: level1Wallet.usdt_balance + level1Bonus })
          .eq("user_id", upline.level1);

        await recordReferralBonus(
          req.user.id,
          upline.level1,
          level1Bonus,
          1,
          "one_time_purchase",
          package_id,
        );
      }
    }

    if (upline.level2) {
      const level2Bonus = (investmentAmount * 3) / 100;
      const { data: level2Wallet } = await supabase
        .from("wallets")
        .select("usdt_balance")
        .eq("user_id", upline.level2)
        .single();

      if (level2Wallet) {
        await supabase
          .from("wallets")
          .update({ usdt_balance: level2Wallet.usdt_balance + level2Bonus })
          .eq("user_id", upline.level2);

        await recordReferralBonus(
          req.user.id,
          upline.level2,
          level2Bonus,
          2,
          "one_time_purchase",
          package_id,
        );
      }
    }

    if (upline.level3) {
      const level3Bonus = (investmentAmount * 2) / 100;
      const { data: level3Wallet } = await supabase
        .from("wallets")
        .select("usdt_balance")
        .eq("user_id", upline.level3)
        .single();

      if (level3Wallet) {
        await supabase
          .from("wallets")
          .update({ usdt_balance: level3Wallet.usdt_balance + level3Bonus })
          .eq("user_id", upline.level3);

        await recordReferralBonus(
          req.user.id,
          upline.level3,
          level3Bonus,
          3,
          "one_time_purchase",
          package_id,
        );
      }
    }

    // Update user's rank based on new investment
    await updateUserRank(req.user.id);

    res.json({
      success: true,
      purchase: {
        id: purchaseId,
        package_id,
        amount: investmentAmount,
        daily_percent: pkgConfig.daily_percent,
        duration_days: pkgConfig.duration_days,
      },
    });
  } catch (error: any) {
    console.error("Package purchase error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get user's active purchases
router.get(
  "/user/purchases",
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const { data: purchases, error: purchasesError } = await supabase
        .from("purchases")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (purchasesError) {
        throw purchasesError;
      }

      const packageIds = Array.from(
        new Set((purchases || []).map((p: any) => p.package_id))
      );

      const { data: packageData, error: packagesError } = packageIds.length
        ? await supabase
            .from("packages")
            .select("id,name,daily_percentage")
            .in("id", packageIds)
        : { data: [], error: null };

      if (packagesError) {
        throw packagesError;
      }

      const packageMap = (packageData || []).reduce<Record<string, any>>(
        (acc, pkg) => {
          acc[pkg.id] = pkg;
          return acc;
        },
        {}
      );

      const enrichedPurchases = (purchases || []).map((p: any) => {
        const pkg = packageMap[p.package_id] || {};
        const dailyEarning = (p.amount * (pkg.daily_percentage || 0)) / 100;
        return {
          ...p,
          name: pkg.name,
          daily_percentage: pkg.daily_percentage,
          accrued_earnings: dailyEarning,
          daily_earning: dailyEarning,
        };
      });

      res.json({
        purchases: enrichedPurchases,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
);

export default router;
