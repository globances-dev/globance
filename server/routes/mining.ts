import { Router, Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { verifyToken } from "../utils/jwt";

const router = Router();

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface Purchase {
  id: string;
  user_id: string;
  package_id: string;
  amount: number;
  status: string;
  created_at?: string;
  total_earned?: number;
  last_reward_time?: string;
  daily_percentage?: number;
}

interface PackageInfo {
  id: string;
  name?: string;
  daily_percentage?: number;
  daily_percent?: number;
  duration_days?: number;
}

async function fetchPackageMap(packageIds: string[]): Promise<Record<string, PackageInfo>> {
  if (packageIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("packages")
    .select("id, name, daily_percentage, duration_days")
    .in("id", packageIds);

  if (error) {
    console.error("[MINING] Failed to fetch packages:", error.message);
    return {};
  }

  return (data || []).reduce<Record<string, PackageInfo>>((acc, pkg) => {
    acc[pkg.id] = pkg;
    return acc;
  }, {});
}

async function fetchReferrer(userId: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("users")
    .select("referred_by")
    .eq("id", userId)
    .single();

  if (error) {
    console.error(`[MINING] Failed to fetch referrer for user ${userId}:`, error.message);
    return undefined;
  }

  return data?.referred_by || undefined;
}

async function creditWallet(userId: string, amount: number): Promise<void> {
  const { data, error } = await supabase
    .from("wallets")
    .select("usdt_balance")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error(`[MINING] Failed to fetch wallet for ${userId}:`, error.message);
    throw new Error("Failed to fetch wallet");
  }

  const currentBalance = data?.usdt_balance || 0;
  const newBalance = currentBalance + amount;

  const { error: updateError } = await supabase
    .from("wallets")
    .update({ usdt_balance: newBalance })
    .eq("user_id", userId);

  if (updateError) {
    console.error(`[MINING] Failed to update wallet for ${userId}:`, updateError.message);
    throw new Error("Failed to update wallet balance");
  }
}

async function insertReferralBonus(
  fromUserId: string,
  toUserId: string,
  amount: number,
  level: number,
  packageId: string,
  createdAt: string
) {
  const { error } = await supabase.from("referral_bonus_transactions").insert({
    user_id: fromUserId,
    recipient_id: toUserId,
    amount,
    level,
    bonus_type: "daily_referral_income",
    package_id: packageId,
    created_at: createdAt,
  });

  if (error) {
    console.error("[MINING] Failed to insert referral bonus:", error.message);
  }
}

async function insertEarningsTransaction(
  userId: string,
  packageId: string,
  amount: number,
  createdAt: string
) {
  const { error } = await supabase.from("earnings_transactions").insert({
    user_id: userId,
    package_id: packageId,
    amount,
    type: "daily_mining_income",
    created_at: createdAt,
  });

  if (error) {
    console.error("[MINING] Failed to insert earnings transaction:", error.message);
  }
}

async function getUplineUsers(
  userId: string
): Promise<{ level1?: string; level2?: string; level3?: string }> {
  const upline: { level1?: string; level2?: string; level3?: string } = {};

  const level1 = await fetchReferrer(userId);
  if (!level1) {
    return upline;
  }

  upline.level1 = level1;

  const level2 = await fetchReferrer(level1);
  if (level2) {
    upline.level2 = level2;

    const level3 = await fetchReferrer(level2);
    if (level3) {
      upline.level3 = level3;
    }
  }

  return upline;
}

async function processDailyEarnings(): Promise<{ processed: number; skipped: number }> {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: purchases, error: purchasesError } = await supabase
    .from("purchases")
    .select("*")
    .eq("status", "active");

  if (purchasesError) {
    console.error("[MINING] Failed to fetch active purchases:", purchasesError.message);
    throw new Error("Failed to fetch active purchases");
  }

  const purchaseList = (purchases || []) as Purchase[];

  if (purchaseList.length === 0) {
    return { processed: 0, skipped: 0 };
  }

  const packageIds = Array.from(new Set(purchaseList.map((p) => p.package_id)));
  const packageMap = await fetchPackageMap(packageIds);

  let processed = 0;
  let skipped = 0;

  for (const purchase of purchaseList) {
    try {
      const lastRewardTime = purchase.last_reward_time
        ? new Date(purchase.last_reward_time)
        : undefined;

      if (lastRewardTime && now.getTime() - lastRewardTime.getTime() < DAY_IN_MS) {
        skipped++;
        continue;
      }

      const pkgDetails = packageMap[purchase.package_id];
      const dailyPercent =
        purchase.daily_percentage ?? pkgDetails?.daily_percentage ?? pkgDetails?.daily_percent;

      if (!dailyPercent || dailyPercent <= 0) {
        skipped++;
        continue;
      }

      const dailyEarning = (purchase.amount * dailyPercent) / 100;

      const newTotalEarned = (purchase.total_earned || 0) + dailyEarning;

      const { error: purchaseUpdateError } = await supabase
        .from("purchases")
        .update({
          total_earned: newTotalEarned,
          last_reward_time: nowIso,
        })
        .eq("id", purchase.id);

      if (purchaseUpdateError) {
        console.error(
          `[MINING] Failed to update purchase ${purchase.id}:`,
          purchaseUpdateError.message
        );
        skipped++;
        continue;
      }

      await creditWallet(purchase.user_id, dailyEarning);
      await insertEarningsTransaction(purchase.user_id, purchase.package_id, dailyEarning, nowIso);

      const upline = await getUplineUsers(purchase.user_id);

      if (upline.level1) {
        const level1Commission = (dailyEarning * 10) / 100;
        await creditWallet(upline.level1, level1Commission);
        await insertReferralBonus(
          purchase.user_id,
          upline.level1,
          level1Commission,
          1,
          purchase.package_id,
          nowIso
        );
      }

      if (upline.level2) {
        const level2Commission = (dailyEarning * 3) / 100;
        await creditWallet(upline.level2, level2Commission);
        await insertReferralBonus(
          purchase.user_id,
          upline.level2,
          level2Commission,
          2,
          purchase.package_id,
          nowIso
        );
      }

      if (upline.level3) {
        const level3Commission = (dailyEarning * 2) / 100;
        await creditWallet(upline.level3, level3Commission);
        await insertReferralBonus(
          purchase.user_id,
          upline.level3,
          level3Commission,
          3,
          purchase.package_id,
          nowIso
        );
      }

      processed++;
    } catch (error) {
      console.error(`[MINING] Error processing purchase ${purchase.id}:`, error);
      skipped++;
    }
  }

  return { processed, skipped };
}

// Manual trigger endpoint for testing/admin (primary cron is internal via node-cron at 21:00 UTC)
router.post("/process-daily-earnings", async (_req: Request, res: Response) => {
  try {
    const result = await processDailyEarnings();

    res.json({
      success: true,
      processed: result.processed,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error("[API] Error in manual trigger:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint - for manual debugging only
router.post("/run-daily-earnings-test", async (_req: Request, res: Response) => {
  try {
    const result = await processDailyEarnings();

    res.json({
      success: true,
      processed: result.processed,
      skipped: result.skipped,
      testMessage:
        "This is a TEST run. It does NOT check for daily idempotency like the real cron does.",
    });
  } catch (error: any) {
    console.error("[TEST] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's active mining packages
router.get("/my-packages", async (req: any, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = decoded.id;

    console.log(`[MINING] Fetching packages for user: ${userId}`);

    const { data: purchases, error: purchasesError } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (purchasesError) {
      throw new Error(purchasesError.message);
    }

    const purchaseList = (purchases || []) as Purchase[];

    if (purchaseList.length === 0) {
      return res.json({ packages: [] });
    }

    const packageIds = Array.from(new Set(purchaseList.map((p) => p.package_id)));
    const packageMap = await fetchPackageMap(packageIds);

    const activePackages = purchaseList.map((p: Purchase) => {
      const pkg = packageMap[p.package_id];
      const startDate = p.created_at ? new Date(p.created_at) : new Date();
      const durationDays = pkg?.duration_days || 270;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);

      const today = new Date();
      const timeDiff = endDate.getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

      return {
        id: p.id,
        package_id: p.package_id,
        package_name: pkg?.name || p.package_id,
        amount: p.amount,
        daily_percent: pkg?.daily_percentage || 0,
        start_date: p.created_at,
        end_date: endDate.toISOString(),
        days_remaining: daysRemaining,
        total_earned: p.total_earned || 0,
        is_active: daysRemaining > 0,
      };
    });

    console.log(`[MINING] Returning ${activePackages.length} active packages`);

    res.json({ packages: activePackages });
  } catch (error: any) {
    console.error("[MINING] Error fetching packages:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily earnings for a user
router.get("/daily-earnings/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    const { data, error } = await supabase
      .from("earnings_transactions")
      .select("amount, created_at")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    if (error) {
      throw new Error(error.message);
    }

    const totalEarned = (data || []).reduce((sum, row) => sum + (row.amount || 0), 0);

    res.json({ total_earned: totalEarned, date: startOfDay.toISOString().split("T")[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
