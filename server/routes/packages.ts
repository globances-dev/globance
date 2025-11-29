import { Router, Request, Response } from "express";
import { getPostgresPool } from "../utils/postgres";
import { verifyToken } from "../utils/jwt";
import { z } from "zod";
import {
  checkPackageEligibility,
  updateUserRank,
  recordReferralBonus,
  getUplineUsers,
  PACKAGES_CONFIG,
} from "../utils/referral";

const router = Router();

// ======================
// AUTH MIDDLEWARE
// ======================
const authMiddleware = (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = decoded;
  next();
};

// ======================
// GET ALL PACKAGES
// ======================
router.get("/", async (req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query("SELECT * FROM packages ORDER BY id");

    res.json({ packages: result.rows || [] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ======================
// GET PACKAGE BY ID
// ======================
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      "SELECT * FROM packages WHERE id = $1",
      [req.params.id]
    );

    if (!result.rows?.length) {
      return res.status(404).json({ error: "Package not found" });
    }

    res.json({ package: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ======================
// BUY PACKAGE (COMPLETE)
// ======================
router.post("/buy", authMiddleware, async (req: any, res: Response) => {
  try {
    console.log("[BUY_PACKAGE] Starting");

    const { package_id, amount } = z
      .object({
        package_id: z.string(),
        amount: z.number().optional(),
      })
      .parse(req.body);

    const configId = package_id.trim().toLowerCase();
    console.log("[BUY_PACKAGE] Package:", configId);

    const pkgConfig = PACKAGES_CONFIG.find((p) => p.id === configId);
    if (!pkgConfig) {
      return res.status(404).json({ error: "Package not found" });
    }

    // Amount validation
    const investmentAmount = amount || pkgConfig.min_invest;
    if (investmentAmount < pkgConfig.min_invest) {
      return res.status(400).json({
        error: `Minimum investment is ${pkgConfig.min_invest} USDT`,
      });
    }

    const pool = getPostgresPool();

    // Wallet balance check
    const walletResult = await pool.query(
      "SELECT usdt_balance FROM wallets WHERE user_id = $1",
      [req.user.id]
    );

    if (!walletResult.rows?.length) {
      return res.status(400).json({ error: "Wallet not found" });
    }

    const wallet = walletResult.rows[0];
    if (wallet.usdt_balance < investmentAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Eligibility checks
    const eligibility = await checkPackageEligibility(req.user.id, configId);
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.reason });
    }

    // ======================
    // CREATE PURCHASE
    // ======================
    const insertResult = await pool.query(
      `INSERT INTO purchases (
        user_id,
        package_id,
        amount,
        status,
        start_time,
        end_time,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '${pkgConfig.duration_days} days',
        CURRENT_TIMESTAMP
      )
      RETURNING id`,
      [req.user.id, configId, investmentAmount]
    );

    const purchase = insertResult.rows[0];
    console.log("[BUY_PACKAGE] Purchase created:", purchase.id);

    // ======================
    // WALLET DEDUCTION
    // ======================
    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance - $1 WHERE user_id = $2",
      [investmentAmount, req.user.id]
    );

    // ======================
    // REFERRAL BONUSES
    // ======================
    const upline = await getUplineUsers(req.user.id);

    // Level 1: 10%
    if (upline.level1) {
      const bonus = investmentAmount * 0.10;
      await pool.query(
        "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [bonus, upline.level1]
      );
      await recordReferralBonus(req.user.id, upline.level1, bonus, 1, "one_time_purchase", configId);
    }

    // Level 2: 3%
    if (upline.level2) {
      const bonus = investmentAmount * 0.03;
      await pool.query(
        "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [bonus, upline.level2]
      );
      await recordReferralBonus(req.user.id, upline.level2, bonus, 2, "one_time_purchase", configId);
    }

    // Level 3: 2%
    if (upline.level3) {
      const bonus = investmentAmount * 0.02;
      await pool.query(
        "UPDATE wallets SET usdt_balance = usdt_balance + $1 WHERE user_id = $2",
        [bonus, upline.level3]
      );
      await recordReferralBonus(req.user.id, upline.level3, bonus, 3, "one_time_purchase", configId);
    }

    // ======================
    // UPDATE RANK
    // ======================
    await updateUserRank(req.user.id);

    // SUCCESS RESPONSE
    res.json({
      success: true,
      purchase: {
        id: purchase.id,
        package_id: configId,
        amount: investmentAmount,
        daily_percent: pkgConfig.daily_percent,
        duration_days: pkgConfig.duration_days,
      },
    });
  } catch (error: any) {
    console.error("Buy Package Error:", error);
    res.status(400).json({ error: error.message });
  }
});

// ======================
// GET USER PACKAGES
// ======================
router.get(
  "/user/purchases",
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const pool = getPostgresPool();
      const result = await pool.query(
        `SELECT p.*, pkg.name, pkg.daily_percent 
         FROM purchases p
         LEFT JOIN packages pkg ON p.package_id = pkg.id
         WHERE p.user_id = $1 AND p.status = 'active'
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );

      const enriched = (result.rows || []).map((p: any) => ({
        ...p,
        daily_earning: (p.amount * p.daily_percent) / 100,
      }));

      res.json({ purchases: enriched });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;



