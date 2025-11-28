import { Router, Request, Response } from "express";
import { getPostgresPool } from "../utils/postgres";
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

// Map database package IDs (1,2,3) to config IDs ("bronze","silver","gold")
const DB_TO_CONFIG_ID: Record<string, string> = {
  "1": "bronze",
  "2": "silver",
  "3": "gold",
  "4": "platinum",
  "5": "diamond",
  "6": "legendary",
};

// Reverse mapping: config IDs to database IDs
const CONFIG_TO_DB_ID: Record<string, number> = {
  "bronze": 1,
  "silver": 2,
  "gold": 3,
  "platinum": 4,
  "diamond": 5,
  "legendary": 6,
};

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
    const pool = getPostgresPool();
    const result = await pool.query(
      "SELECT * FROM packages ORDER BY id"
    );

    res.json({
      packages: result.rows || [],
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get package details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      "SELECT * FROM packages WHERE id = $1",
      [req.params.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ package: result.rows[0] });
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

    // Convert database numeric ID to config string ID if needed
    const configId = DB_TO_CONFIG_ID[package_id] || package_id;
    
    // Find package config
    const pkgConfig = PACKAGES_CONFIG.find((p) => p.id === configId);
    if (!pkgConfig) {
      console.log(`[BUY_PACKAGE] Package config not found: ${package_id} (mapped to ${configId})`);
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

    const pool = getPostgresPool();

    // Check referral requirements for non-Bronze packages
    if (pkgConfig.referral_required > 0) {
      const eligibility = await checkPackageEligibility(req.user.id, String(CONFIG_TO_DB_ID[configId] || package_id));
      if (!eligibility.eligible) {
        console.log(`[BUY_PACKAGE] Eligibility check failed: ${eligibility.reason}`);
        return res.status(400).json({ 
          error: eligibility.reason || `You need ${pkgConfig.referral_required} active referrals to buy this package` 
        });
      }
    }

    // Get user wallet
    const walletResult = await pool.query(
      "SELECT usdt_balance FROM wallets WHERE user_id = $1",
      [req.user.id]
    );

    if (!walletResult.rows || walletResult.rows.length === 0) {
      return res.status(400).json({ error: "Wallet not found" });
    }

    const wallet = walletResult.rows[0];

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
      package_id: parseInt(package_id),
      amount: investmentAmount,
      start_time: now,
      end_time: endTime,
      status: "active",
    });

    // Get the numeric database ID for the package
    const dbPackageId = CONFIG_TO_DB_ID[configId] || parseInt(package_id) || 1;
    console.log(`[BUY_PACKAGE] Database package ID: ${dbPackageId} (from configId: ${configId})`);

    // Insert purchase (use numeric package_id for database)
    let purchaseId: string = "";
    try {
      const insertResult = await pool.query(
        `INSERT INTO purchases (user_id, package_id, amount, status, created_at)
         VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)
         RETURNING id`,
        [req.user.id, dbPackageId, investmentAmount]
      );

      if (!insertResult.rows || insertResult.rows.length === 0) {
        throw new Error("Insert returned no data");
      }

      const purchase = insertResult.rows[0];
      purchaseId = purchase.id;
      console.log(`[BUY_PACKAGE] ✓ Purchase created with ID: ${purchaseId}`);
    } catch (insertError: any) {
      console.error("[BUY_PACKAGE] Insert exception:", insertError);
      return res.status(400).json({ error: `Insert failed: ${insertError.message}` });
    }

    // Deduct from wallet
    console.log("[BUY_PACKAGE] Deducting from wallet:", investmentAmount);
    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance - $1 WHERE user_id = $2",
      [investmentAmount, req.user.id]
    );
    console.log("[BUY_PACKAGE] ✓ Wallet updated");

    // Get upline users and process one-time purchase bonuses
    const upline = await getUplineUsers(req.user.id);

    if (upline.level1) {
      const level1Bonus = (investmentAmount * 10) / 100;
      const level1Result = await pool.query(
        "SELECT usdt_balance FROM wallets WHERE user_id = $1",
        [upline.level1]
      );

      if (level1Result.rows && level1Result.rows.length > 0) {
        await pool.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
          [level1Bonus, upline.level1]
        );

        await recordReferralBonus(
          req.user.id,
          upline.level1,
          level1Bonus,
          1,
          "one_time_purchase",
          configId,
        );
      }
    }

    if (upline.level2) {
      const level2Bonus = (investmentAmount * 3) / 100;
      const level2Result = await pool.query(
        "SELECT usdt_balance FROM wallets WHERE user_id = $1",
        [upline.level2]
      );

      if (level2Result.rows && level2Result.rows.length > 0) {
        await pool.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
          [level2Bonus, upline.level2]
        );

        await recordReferralBonus(
          req.user.id,
          upline.level2,
          level2Bonus,
          2,
          "one_time_purchase",
          configId,
        );
      }
    }

    if (upline.level3) {
      const level3Bonus = (investmentAmount * 2) / 100;
      const level3Result = await pool.query(
        "SELECT usdt_balance FROM wallets WHERE user_id = $1",
        [upline.level3]
      );

      if (level3Result.rows && level3Result.rows.length > 0) {
        await pool.query(
          "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
          [level3Bonus, upline.level3]
        );

        await recordReferralBonus(
          req.user.id,
          upline.level3,
          level3Bonus,
          3,
          "one_time_purchase",
          configId,
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
      const pool = getPostgresPool();
      const result = await pool.query(
        `SELECT p.*, pkg.name, pkg.daily_percentage FROM purchases p
         LEFT JOIN packages pkg ON p.package_id = pkg.id
         WHERE p.user_id = $1 AND p.status = 'active'
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );

      // Calculate accrued earnings for each purchase
      const now = Date.now();
      const enrichedPurchases = (result.rows || []).map((p: any) => {
        const dailyEarning = (p.amount * (p.daily_percentage || 0)) / 100;
        return {
          ...p,
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
