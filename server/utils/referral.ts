import { getSupabaseQueryClient } from "./supabase";

export const PACKAGES_CONFIG = [
  {
    id: "bronze",
    name: "Bronze",
    min_invest: 10,
    daily_percent: 2.5,
    duration_days: 270,
    referral_required: 0,
    rank_order: 1,
  },
  {
    id: "silver",
    name: "Silver",
    min_invest: 100,
    daily_percent: 2.6,
    duration_days: 270,
    referral_required: 5,
    rank_order: 2,
  },
  {
    id: "gold",
    name: "Gold",
    min_invest: 300,
    daily_percent: 2.7,
    duration_days: 270,
    referral_required: 10,
    rank_order: 3,
  },
  {
    id: "platinum",
    name: "Platinum",
    min_invest: 500,
    daily_percent: 2.8,
    duration_days: 270,
    referral_required: 15,
    rank_order: 4,
  },
  {
    id: "diamond",
    name: "Diamond",
    min_invest: 700,
    daily_percent: 2.9,
    duration_days: 270,
    referral_required: 20,
    rank_order: 5,
  },
  {
    id: "legendary",
    name: "Legendary",
    min_invest: 1000,
    daily_percent: 3.0,
    duration_days: 270,
    referral_required: 25,
    rank_order: 6,
  },
];

export interface UserRankInfo {
  current_rank: string;
  total_invested: number;
  active_referral_count: number;
  highest_qualified_rank: string;
}

/**
 * Count active direct referrals for a user (users who have this user as their sponsor)
 * Active = they have at least one active package
 */
export async function countActiveDirectReferrals(
  userId: string,
): Promise<number> {
  try {
    const pool = getSupabaseQueryClient();
    
    const result = await pool.query(`
      SELECT COUNT(DISTINCT p.user_id) as count
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'active' AND u.referred_by = $1
    `, [userId]);

    return parseInt(result.rows[0]?.count) || 0;
  } catch (error) {
    console.error("Error counting active direct referrals:", error);
    return 0;
  }
}

/**
 * Get total amount invested by a user across all purchases
 */
export async function getTotalInvestedAmount(userId: string): Promise<number> {
  try {
    const pool = getSupabaseQueryClient();
    
    const result = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM purchases
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    return parseFloat(result.rows[0]?.total) || 0;
  } catch (error) {
    console.error("Error getting total invested amount:", error);
    return 0;
  }
}

/**
 * Calculate the highest rank a user qualifies for based on:
 * - Total investment amount
 * - Number of active direct referrals with active packages
 */
export async function calculateHighestQualifiedRank(
  userId: string,
): Promise<string> {
  try {
    const totalInvested = await getTotalInvestedAmount(userId);
    const activeReferrals = await countActiveDirectReferrals(userId);

    // Check from highest to lowest rank
    for (let i = PACKAGES_CONFIG.length - 1; i >= 0; i--) {
      const pkg = PACKAGES_CONFIG[i];
      if (
        totalInvested >= pkg.min_invest &&
        activeReferrals >= pkg.referral_required
      ) {
        return pkg.name;
      }
    }

    return "Bronze";
  } catch (error) {
    console.error("Error calculating highest qualified rank:", error);
    return "Bronze";
  }
}

/**
 * Get user's current rank info
 */
export async function getUserRankInfo(userId: string): Promise<UserRankInfo> {
  try {
    const pool = getSupabaseQueryClient();
    
    const userResult = await pool.query(
      "SELECT current_rank FROM users WHERE id = $1",
      [userId]
    );

    const currentRank = userResult.rows[0]?.current_rank || "Bronze";
    const totalInvested = await getTotalInvestedAmount(userId);
    const activeReferralCount = await countActiveDirectReferrals(userId);
    const highestQualifiedRank = await calculateHighestQualifiedRank(userId);

    return {
      current_rank: currentRank,
      total_invested: totalInvested,
      active_referral_count: activeReferralCount,
      highest_qualified_rank: highestQualifiedRank,
    };
  } catch (error) {
    console.error("Error getting user rank info:", error);
    return {
      current_rank: "Bronze",
      total_invested: 0,
      active_referral_count: 0,
      highest_qualified_rank: "Bronze",
    };
  }
}

/**
 * Update user's rank if they qualify for a higher one
 */
export async function updateUserRank(userId: string): Promise<string> {
  try {
    const highestQualifiedRank = await calculateHighestQualifiedRank(userId);
    
    const pool = getSupabaseQueryClient();
    await pool.query(
      "UPDATE users SET current_rank = $1 WHERE id = $2",
      [highestQualifiedRank, userId]
    );

    return highestQualifiedRank;
  } catch (error) {
    console.error("Error updating user rank:", error);
    return "Bronze";
  }
}

/**
 * Get the referral bonus percentages for each level
 */
export function getReferralBonusPercentages(): { level1: number; level2: number; level3: number } {
  return {
    level1: 10, // 10% of daily earnings
    level2: 3,  // 3% of daily earnings
    level3: 2,  // 2% of daily earnings
  };
}

/**
 * Process referral bonuses for a user's daily mining earnings
 */
export async function processReferralBonuses(
  userId: string,
  dailyEarning: number,
  purchaseId: string
): Promise<void> {
  try {
    const pool = getSupabaseQueryClient();
    const bonuses = getReferralBonusPercentages();

    // Level 1 referrer
    const level1Result = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [userId]
    );

    if (!level1Result.rows[0]?.referred_by) return;

    const level1ReferrerId = level1Result.rows[0].referred_by;
    const level1Bonus = dailyEarning * (bonuses.level1 / 100);

    // Credit level 1 bonus
    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_referral_earned = total_referral_earned + $1 WHERE user_id = $2",
      [level1Bonus, level1ReferrerId]
    );

    await pool.query(
      `INSERT INTO referral_bonus_transactions (from_user_id, to_user_id, amount, level, type, source_purchase_id)
       VALUES ($1, $2, $3, 1, 'daily_bonus', $4)`,
      [userId, level1ReferrerId, level1Bonus, purchaseId]
    );

    // Level 2 referrer
    const level2Result = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [level1ReferrerId]
    );

    if (!level2Result.rows[0]?.referred_by) return;

    const level2ReferrerId = level2Result.rows[0].referred_by;
    const level2Bonus = dailyEarning * (bonuses.level2 / 100);

    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_referral_earned = total_referral_earned + $1 WHERE user_id = $2",
      [level2Bonus, level2ReferrerId]
    );

    await pool.query(
      `INSERT INTO referral_bonus_transactions (from_user_id, to_user_id, amount, level, type, source_purchase_id)
       VALUES ($1, $2, $3, 2, 'daily_bonus', $4)`,
      [userId, level2ReferrerId, level2Bonus, purchaseId]
    );

    // Level 3 referrer
    const level3Result = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [level2ReferrerId]
    );

    if (!level3Result.rows[0]?.referred_by) return;

    const level3ReferrerId = level3Result.rows[0].referred_by;
    const level3Bonus = dailyEarning * (bonuses.level3 / 100);

    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_referral_earned = total_referral_earned + $1 WHERE user_id = $2",
      [level3Bonus, level3ReferrerId]
    );

    await pool.query(
      `INSERT INTO referral_bonus_transactions (from_user_id, to_user_id, amount, level, type, source_purchase_id)
       VALUES ($1, $2, $3, 3, 'daily_bonus', $4)`,
      [userId, level3ReferrerId, level3Bonus, purchaseId]
    );

  } catch (error) {
    console.error("Error processing referral bonuses:", error);
  }
}

/**
 * Process one-time referral bonus when user purchases a package
 */
export async function processPurchaseReferralBonus(
  userId: string,
  purchaseAmount: number,
  purchaseId: string
): Promise<void> {
  try {
    const pool = getSupabaseQueryClient();
    const bonuses = getReferralBonusPercentages();

    // Level 1 referrer
    const level1Result = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [userId]
    );

    if (!level1Result.rows[0]?.referred_by) return;

    const level1ReferrerId = level1Result.rows[0].referred_by;
    const level1Bonus = purchaseAmount * (bonuses.level1 / 100);

    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_referral_earned = total_referral_earned + $1 WHERE user_id = $2",
      [level1Bonus, level1ReferrerId]
    );

    await pool.query(
      `INSERT INTO referral_bonus_transactions (from_user_id, to_user_id, amount, level, type, source_purchase_id)
       VALUES ($1, $2, $3, 1, 'purchase_bonus', $4)`,
      [userId, level1ReferrerId, level1Bonus, purchaseId]
    );

    // Level 2 referrer
    const level2Result = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [level1ReferrerId]
    );

    if (!level2Result.rows[0]?.referred_by) return;

    const level2ReferrerId = level2Result.rows[0].referred_by;
    const level2Bonus = purchaseAmount * (bonuses.level2 / 100);

    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_referral_earned = total_referral_earned + $1 WHERE user_id = $2",
      [level2Bonus, level2ReferrerId]
    );

    await pool.query(
      `INSERT INTO referral_bonus_transactions (from_user_id, to_user_id, amount, level, type, source_purchase_id)
       VALUES ($1, $2, $3, 2, 'purchase_bonus', $4)`,
      [userId, level2ReferrerId, level2Bonus, purchaseId]
    );

    // Level 3 referrer
    const level3Result = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [level2ReferrerId]
    );

    if (!level3Result.rows[0]?.referred_by) return;

    const level3ReferrerId = level3Result.rows[0].referred_by;
    const level3Bonus = purchaseAmount * (bonuses.level3 / 100);

    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance + $1, total_referral_earned = total_referral_earned + $1 WHERE user_id = $2",
      [level3Bonus, level3ReferrerId]
    );

    await pool.query(
      `INSERT INTO referral_bonus_transactions (from_user_id, to_user_id, amount, level, type, source_purchase_id)
       VALUES ($1, $2, $3, 3, 'purchase_bonus', $4)`,
      [userId, level3ReferrerId, level3Bonus, purchaseId]
    );

  } catch (error) {
    console.error("Error processing purchase referral bonus:", error);
  }
}

/**
 * Check if a user is eligible to purchase a specific package
 */
export async function checkPackageEligibility(
  userId: string,
  packageId: string
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const pool = getSupabaseQueryClient();
    
    // Get package requirements
    const packageResult = await pool.query(
      "SELECT * FROM packages WHERE id = $1",
      [packageId]
    );

    if (!packageResult.rows.length) {
      return { eligible: false, reason: "Package not found" };
    }

    const pkg = packageResult.rows[0];

    // Get user's wallet balance
    const walletResult = await pool.query(
      "SELECT usdt_balance FROM wallets WHERE user_id = $1",
      [userId]
    );

    const balance = parseFloat(walletResult.rows[0]?.usdt_balance || 0);
    const minAmount = parseFloat(pkg.min_investment || pkg.min_amount || 0);

    if (balance < minAmount) {
      return { 
        eligible: false, 
        reason: `Insufficient balance. Need ${minAmount} USDT, have ${balance} USDT` 
      };
    }

    // Check referral requirements if any
    const referralRequired = pkg.referral_required || 0;
    if (referralRequired > 0) {
      const activeReferrals = await countActiveDirectReferrals(userId);
      if (activeReferrals < referralRequired) {
        return {
          eligible: false,
          reason: `Need ${referralRequired} active referrals, have ${activeReferrals}`,
        };
      }
    }

    return { eligible: true };
  } catch (error) {
    console.error("Error checking package eligibility:", error);
    return { eligible: false, reason: "Error checking eligibility" };
  }
}

/**
 * Get upline users (referrers) up to 3 levels
 * Returns object with level1, level2, level3 user IDs
 */
export async function getUplineUsers(
  userId: string
): Promise<{ level1?: string; level2?: string; level3?: string }> {
  const upline: { level1?: string; level2?: string; level3?: string } = {};

  try {
    const pool = getSupabaseQueryClient();
    let currentUserId = userId;

    // Level 1
    const result1 = await pool.query(
      "SELECT referred_by FROM users WHERE id = $1",
      [currentUserId]
    );
    const level1Id = result1.rows[0]?.referred_by;
    if (level1Id) {
      upline.level1 = level1Id;
      currentUserId = level1Id;

      // Level 2
      const result2 = await pool.query(
        "SELECT referred_by FROM users WHERE id = $1",
        [currentUserId]
      );
      const level2Id = result2.rows[0]?.referred_by;
      if (level2Id) {
        upline.level2 = level2Id;
        currentUserId = level2Id;

        // Level 3
        const result3 = await pool.query(
          "SELECT referred_by FROM users WHERE id = $1",
          [currentUserId]
        );
        const level3Id = result3.rows[0]?.referred_by;
        if (level3Id) {
          upline.level3 = level3Id;
        }
      }
    }

    return upline;
  } catch (error) {
    console.error("Error getting upline users:", error);
    return {};
  }
}

/**
 * Record referral bonus for a single upline user
 */
export async function recordReferralBonus(
  fromUserId: string,
  toUserId: string,
  amount: number,
  level: number,
  bonusType: string,
  packageId?: string | number
): Promise<void> {
  try {
    const pool = getSupabaseQueryClient();
    
    await pool.query(
      `INSERT INTO referral_bonus_transactions (user_id, recipient_id, amount, level, bonus_type, package_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [fromUserId, toUserId, amount, level, bonusType, packageId?.toString() || null]
    );
  } catch (error) {
    console.error("Error recording referral bonus:", error);
  }
}

/**
 * Record an earnings transaction
 */
export async function recordEarningsTransaction(
  userId: string,
  amount: number,
  type: "daily_mining" | "referral_bonus" | "deposit" | "withdrawal" | "package_purchase",
  description?: string,
  purchaseId?: string
): Promise<void> {
  try {
    const pool = getSupabaseQueryClient();
    
    await pool.query(
      `INSERT INTO earnings_transactions (user_id, purchase_id, amount, type, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, purchaseId || null, amount, type, description || null]
    );
  } catch (error) {
    console.error("Error recording earnings transaction:", error);
  }
}
