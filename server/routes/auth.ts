import { Router, Request, Response } from "express";
import { getSupabaseAdmin } from "../utils/supabase";
import { signToken, verifyToken } from "../utils/jwt";
import {
  hashPassword,
  comparePassword,
  generateReferralCode,
  generateResetToken,
} from "../utils/crypto";
import { sendRegistrationEmail, sendPasswordResetEmail } from "../utils/email";
import { createPermanentDepositAddress } from "../utils/nowpayments";
import { z } from "zod";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  ref_by: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post("/register", async (req: Request, res: Response) => {
  try {
    console.log("[Auth] Register request received");
    console.log("[Auth] Request body:", JSON.stringify(req.body));
    const data = RegisterSchema.parse(req.body);
    console.log("[Auth] Validation passed for:", data.email);

    const supabase = getSupabaseAdmin();

    // Check if user exists
    const { data: existingUsers, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("email", data.email)
      .limit(1);

    if (existingError) {
      console.error("[Auth] Database error checking existing user:", existingError);
      return res.status(500).json({ error: "Database error" });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);
    const refCode = generateReferralCode();

    // Check referrer if provided
    let refById: string | null = null;
    if (data.ref_by) {
      const { data: referrers } = await supabase
        .from("users")
        .select("id")
        .eq("ref_code", data.ref_by)
        .limit(1);

      if (referrers && referrers.length > 0) {
        refById = referrers[0].id;
      }
    }

    // Create user with referral code
    const { data: userResult, error: userError } = await supabase
      .from("users")
      .insert({
        email: data.email,
        password_hash: passwordHash,
        full_name: data.full_name,
        ref_code: refCode,
        ref_by: refById,
        is_verified: false,
        current_rank: "Bronze",
      })
      .select("id, email, full_name, ref_code");

    if (userError) {
      console.error("[Auth] Error creating user:", userError);
      return res.status(400).json({ error: "Failed to create user" });
    }

    if (!userResult || userResult.length === 0) {
      return res.status(400).json({ error: "Failed to create user" });
    }

    const newUser = userResult[0];
    console.log("[Auth] User created:", newUser.id);

    // Create wallet
    const { error: walletError } = await supabase
      .from("wallets")
      .insert({
        user_id: newUser.id,
        usdt_balance: 0,
        escrow_balance: 0,
        total_earned: 0,
        total_referral_earned: 0,
      });

    if (walletError) {
      console.error("[Auth] Error creating wallet:", walletError);
    }

    // Create permanent deposit addresses for TRC20 and BEP20
    try {
      const trc20Address = await createPermanentDepositAddress(newUser.id, 'TRC20');
      await supabase
        .from("deposit_addresses")
        .insert({
          user_id: newUser.id,
          network: 'TRC20',
          address: trc20Address.address,
          provider: 'nowpayments',
          provider_wallet_id: trc20Address.paymentId,
          is_active: true,
        });
      console.log(`[NOWPayments] Created permanent TRC20 address for user ${newUser.id}`);
    } catch (addressError: any) {
      console.error('[NOWPayments] TRC20 address creation error:', addressError);
    }

    try {
      const bep20Address = await createPermanentDepositAddress(newUser.id, 'BEP20');
      await supabase
        .from("deposit_addresses")
        .insert({
          user_id: newUser.id,
          network: 'BEP20',
          address: bep20Address.address,
          provider: 'nowpayments',
          provider_wallet_id: bep20Address.paymentId,
          is_active: true,
        });
      console.log(`[NOWPayments] Created permanent BEP20 address for user ${newUser.id}`);
    } catch (addressError: any) {
      console.error('[NOWPayments] BEP20 address creation error:', addressError);
    }

    // Send registration email
    try {
      await sendRegistrationEmail(data.email, data.full_name);
    } catch (emailError: any) {
      console.error("Email sending error:", emailError);
    }

    // Generate token
    const token = signToken({
      id: newUser.id,
      email: newUser.email,
      role: 'user',
    });

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        current_rank: "Bronze",
        ref_code: newUser.ref_code,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    if (error.name === "ZodError") {
      const fieldErrors = error.errors
        .map((e: any) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      console.error("[Auth] Validation errors:", fieldErrors);
      return res
        .status(400)
        .json({ error: "Validation failed: " + fieldErrors });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);

    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", data.email)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];

    // Compare password
    const validPassword = await comparePassword(
      data.password,
      user.password_hash,
    );
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role || 'user',
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        current_rank: user.current_rank || "Bronze",
        ref_code: user.ref_code,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const supabase = getSupabaseAdmin();
    const { data: users, error } = await supabase
      .from("users")
      .select("id, email, full_name, is_verified, created_at, ref_code, current_rank")
      .eq("id", decoded.id)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Auto-generate referral code if missing
    let referralCode = user.ref_code;
    if (!referralCode) {
      referralCode = generateReferralCode();
      try {
        await supabase
          .from("users")
          .update({ ref_code: referralCode })
          .eq("id", user.id);
      } catch (err) {
        console.warn("Failed to auto-generate referral code:", err);
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        current_rank: user.current_rank || "Bronze",
        created_at: user.created_at,
        ref_code: referralCode,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Forgot password - Request reset link
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const pool = getPostgresPool();
    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = $1",
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
      // Don't leak whether email exists - always return success
      return res.json({
        success: true,
        message: "If email exists, reset link sent",
      });
    }

    const user = result.rows[0];
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiration

    console.log("[FORGOT PASSWORD] Generated token for user:", user.id, "email:", email);

    // Store token in database
    try {
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, resetToken, expiresAt.toISOString()]
      );
      console.log("[FORGOT PASSWORD] Token stored successfully");
    } catch (tokenError: any) {
      console.error("[FORGOT PASSWORD] Token storage error:", tokenError.message);
      return res.status(500).json({ error: "Failed to generate reset link - database error" });
    }

    const resetLink = `${process.env.APP_URL || "https://globance.app"}/reset-password?token=${resetToken}`;
    console.log("[FORGOT PASSWORD] Reset link URL:", resetLink);

    // Send email
    const emailSent = await sendPasswordResetEmail(email, resetLink);
    
    if (!emailSent) {
      console.error("[FORGOT PASSWORD] Failed to send reset email to:", email);
      return res.status(500).json({ error: "Failed to send reset email" });
    }

    console.log("[FORGOT PASSWORD] Reset link sent successfully to:", email);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Reset password - Validate token and set new password
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8),
      })
      .parse(req.body);

    const pool = getPostgresPool();

    // Find and validate token
    const tokenResult = await pool.query(
      "SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1",
      [token]
    );

    if (!tokenResult.rows || tokenResult.rows.length === 0) {
      console.error("[RESET PASSWORD] Token not found");
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const resetTokenData = tokenResult.rows[0];

    if (resetTokenData.used_at) {
      return res.status(400).json({ error: "Reset link has already been used" });
    }

    const expiresAt = new Date(resetTokenData.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: "Reset link has expired" });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, resetTokenData.user_id]
    );

    // Mark token as used
    await pool.query(
      "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1",
      [token]
    );

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data" });
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
