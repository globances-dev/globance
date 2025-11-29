import { getSupabaseAdmin } from "./supabase";

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
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("purchases")
      .select("user_id", { count: "exact" })
      .eq("status", "active")
      .in(
        "user_id",
        (
          await supabase.from("users").select("id").eq("ref_by", userId)
        ).data?.map((u: any) => u.id) || [],
      );

    if (error) {
      console.error("Error counting active direct referrals:", error);
      return 0;
    }

    // Count distinct users
    const distinctUserIds = new Set((data || []).map((p) => p.user_id));
    return distinctUserIds.size;
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
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("purchases")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      console.error("Error getting total invested amount:", error);
      return 0;
    }

    const total = (data || []).reduce(
      (sum, p) => sum + parseFloat(p.amount || 0),
      0,
    );
    return total;
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
    const supabase = getSupabaseAdmin();

    const { data: users, error } = await supabase
      .from("users")
      .select("current_rank")
      .eq("id", userId)
      .limit(1);

    const currentRank = users?.[0]?.current_rank || "Bronze";
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

    const supabase = getSupabaseAdmin();
    await supabase
      .from("users")
      .update({ current_rank: highestQualifiedRank })
      .eq("id", userId);

    return highestQualifiedRank;
  } catch (error) {
    console.error("Error updating user rank:", error);
    return "Bronze";
  }
}

/**
 * Get the referral bonus percentages for each level
 */
export function getReferralBonusPercentages(): {
  level1: number;
  level2: number;
  level3: number;
} {
  return {
    level1: 10, // 10% of daily earnings
    level2: 3, // 3% of daily earnings
    level3: 2, // 2% of daily earnings
  };
}

/**
 * Check if a user is eligible to purchase a specific package
 */
export async function checkPackageEligibility(
  userId: string,
  packageId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    // Get package requirements
    const { data: packages } = await supabase
      .from("packages")
      .select("*")
      .eq("id", packageId)
      .limit(1);

    if (!packages || packages.length === 0) {
      return { eligible: false, reason: "Package not found" };
    }

    const pkg = packages[0];

    // Get user's wallet balance
    const { data: wallets } = await supabase
      .from("wallets")
      .select("usdt_balance")
      .eq("user_id", userId)
      .limit(1);

    const balance = parseFloat(wallets?.[0]?.usdt_balance || 0);
    const minAmount = parseFloat(pkg.min_amount || 0);

    if (balance < minAmount) {
      return {
        eligible: false,
        reason: `Insufficient balance. Need ${minAmount} USDT, have ${balance} USDT`,
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
  userId: string,
): Promise<{ level1?: string; level2?: string; level3?: string }> {
  const upline: { level1?: string; level2?: string; level3?: string } = {};

  try {
    const supabase = getSupabaseAdmin();
    let currentUserId = userId;

    // Level 1
    const { data: level1Data } = await supabase
      .from("users")
      .select("ref_by")
      .eq("id", currentUserId)
      .limit(1);

    const level1Id = level1Data?.[0]?.ref_by;
    if (level1Id) {
      upline.level1 = level1Id;
      currentUserId = level1Id;

      // Level 2
      const { data: level2Data } = await supabase
        .from("users")
        .select("ref_by")
        .eq("id", currentUserId)
        .limit(1);

      const level2Id = level2Data?.[0]?.ref_by;
      if (level2Id) {
        upline.level2 = level2Id;
        currentUserId = level2Id;

        // Level 3
        const { data: level3Data } = await supabase
          .from("users")
          .select("ref_by")
          .eq("id", currentUserId)
          .limit(1);

        const level3Id = level3Data?.[0]?.ref_by;
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
  packageId?: string | number,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from("referral_bonus_transactions").insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      level,
      type: bonusType,
      package_id: packageId?.toString() || null,
    });
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
  type:
    | "daily_mining_income"
    | "referral_bonus"
    | "deposit"
    | "withdrawal"
    | "investment",
  packageId?: string,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from("earnings_transactions").insert({
      user_id: userId,
      package_id: packageId || null,
      amount,
      type,
    });
  } catch (error) {
    console.error("Error recording earnings transaction:", error);
  }
}
