import { supabase } from "./supabase";

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

const disabledMessage = "PostgreSQL backend is disabled in Supabase mode";

export async function countActiveDirectReferrals(userId: string): Promise<number> {
  console.log("[Referral] countActiveDirectReferrals skipped:", disabledMessage, userId);
  return 0;
}

export async function getTotalInvestedAmount(userId: string): Promise<number> {
  console.log("[Referral] getTotalInvestedAmount skipped:", disabledMessage, userId);
  return 0;
}

export async function calculateHighestQualifiedRank(userId: string): Promise<string> {
  console.log("[Referral] calculateHighestQualifiedRank skipped:", disabledMessage, userId);
  return "Bronze";
}

export async function getUserRankInfo(userId: string): Promise<UserRankInfo> {
  return {
    current_rank: "Bronze",
    total_invested: 0,
    active_referral_count: 0,
    highest_qualified_rank: "Bronze",
  };
}

export async function updateUserRank(userId: string): Promise<string> {
  console.log("[Referral] updateUserRank skipped:", disabledMessage, userId);
  return "Bronze";
}

export function getReferralBonusPercentages(): { level1: number; level2: number; level3: number } {
  return {
    level1: 10,
    level2: 3,
    level3: 2,
  };
}

export async function processReferralBonuses(userId: string, dailyEarning: number, purchaseId: string): Promise<void> {
  console.log("[Referral] processReferralBonuses skipped:", disabledMessage, userId, dailyEarning, purchaseId);
}

export async function processPurchaseReferralBonus(userId: string, purchaseAmount: number, purchaseId: string): Promise<void> {
  console.log("[Referral] processPurchaseReferralBonus skipped:", disabledMessage, userId, purchaseAmount, purchaseId);
}

export async function checkPackageEligibility(userId: string, packageId: string | number): Promise<{ eligible: boolean; reason?: string }> {
  console.log("[Referral] checkPackageEligibility skipped:", disabledMessage, userId, packageId);
  return { eligible: true };
}

export async function getUplineUsers(userId: string): Promise<{ level1?: string; level2?: string; level3?: string }> {
  console.log("[Referral] getUplineUsers skipped:", disabledMessage, userId);
  return {};
}

export async function recordReferralBonus(
  fromUserId: string,
  toUserId: string,
  amount: number,
  level: number,
  bonusType: string,
  packageId?: string | number
): Promise<void> {
  console.log("[Referral] recordReferralBonus skipped:", disabledMessage, {
    fromUserId,
    toUserId,
    amount,
    level,
    bonusType,
    packageId,
  });
}

export async function recordEarningsTransaction(
  userId: string,
  amount: number,
  type: "daily_mining" | "referral_bonus" | "deposit" | "withdrawal" | "package_purchase",
  description?: string,
  purchaseId?: string
): Promise<void> {
  console.log("[Referral] recordEarningsTransaction skipped:", disabledMessage, {
    userId,
    amount,
    type,
    description,
    purchaseId,
  });
}

export async function updateReferralMetrics(userId: string): Promise<void> {
  console.log("[Referral] updateReferralMetrics skipped:", disabledMessage, userId);
}

export async function ensureWalletExists(userId: string): Promise<void> {
  console.log("[Referral] ensureWalletExists skipped:", disabledMessage, userId);
}

export async function checkUserEligibility(userId: string, packageId: string | number): Promise<{ eligible: boolean; reason?: string }> {
  console.log("[Referral] checkUserEligibility skipped:", disabledMessage, userId, packageId);
  return { eligible: true };
}

export async function updateNetworkMetrics(userId: string, amount: number): Promise<void> {
  console.log("[Referral] updateNetworkMetrics skipped:", disabledMessage, userId, amount);
}

export async function distributeReferralBonus(
  fromUserId: string,
  purchaseAmount: number,
  purchaseId: string | number,
  packageId?: string | number
  ): Promise<void> {
    console.log("[Referral] distributeReferralBonus skipped:", disabledMessage, {
      fromUserId,
      purchaseAmount,
      purchaseId,
      packageId,
    });
  }
