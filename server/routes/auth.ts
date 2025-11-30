import { Router, Request, Response } from "express";
import { getSupabaseQueryClient } from "../utils/supabase";
import { signToken, verifyToken } from "../utils/jwt";
import {
  hashPassword,
  comparePassword,
  generateReferralCode,
  generateResetToken,
} from "../utils/crypto";
import { sendRegistrationEmail, sendPasswordResetEmail } from "../utils/email";
import { createPermanentDepositAddress } from "../utils/nowpayments";
import { z, ZodError } from "zod";

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

    const db = getSupabaseQueryClient();

    // Check if user exists
    const existingResult = await db.exec(
      "SELECT id FROM users WHERE email = $1",
      [data.email]
    );

    if (existingResult.rows && existingResult.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);
    const refCode = generateReferralCode();

    // Check referrer if provided
    let refById: string | null = null;
    if (data.ref_by) {
      const referrerResult = await db.exec(
        "SELECT id FROM users WHERE username = $1",
        [data.ref_by]
      );

      if (referrerResult.rows && referrerResult.rows.length > 0) {
        refById = referrerResult.rows[0].id;
      }
    }

    // Create user with referral code
    const userResult = await db.exec(
      `INSERT INTO users (email, password_hash, username, verified, referral_code)
       VALUES ($1, $2, $3, false, $4)
       RETURNING id, email, username, referral_code`,
      [data.email, passwordHash, data.full_name, refCode]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(400).json({ error: "Failed to create user" });
    }

    const newUser = userResult.rows[0];
    console.log("[Auth] User created:", newUser.id);

    // Create wallet
    await db.exec(
      `INSERT INTO wallets (user_id, usdt_balance)
       VALUES ($1, 0)`,
      [newUser.id]
    );

    // Create permanent deposit addresses for TRC20 and BEP20
    try {
      const trc20Address = await createPermanentDepositAddress(newUser.id, 'TRC20');
      await db.exec(
        `INSERT INTO deposit_addresses (user_id, network, address, provider, provider_wallet_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [newUser.id, 'TRC20', trc20Address.address, 'nowpayments', trc20Address.paymentId]
      );
      console.log(`[NOWPayments] Created permanent TRC20 address for user ${newUser.id}`);
    } catch (addressError: any) {
      console.error('[NOWPayments] TRC20 address creation error:', addressError);
    }

    try {
      const bep20Address = await createPermanentDepositAddress(newUser.id, 'BEP20');
      await db.exec(
        `INSERT INTO deposit_addresses (user_id, network, address, provider, provider_wallet_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [newUser.id, 'BEP20', bep20Address.address, 'nowpayments', bep20Address.paymentId]
      );
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
        full_name: newUser.username,
        current_rank: "Bronze",
        ref_code: newUser.referral_code,
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

    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT * FROM users WHERE email = $1",
      [data.email]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

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
        full_name: user.username,
        current_rank: user.current_rank || "Bronze",
        ref_code: user.referral_code,
      },
    });
  } catch (error: any) {
    console.error("[Auth] Login error:", error);

    if (error instanceof ZodError) {
      const fieldErrors = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");

      return res
        .status(400)
        .json({ error: "Validation failed: " + fieldErrors });
    }

    res.status(500).json({ error: "Login failed. Please try again." });
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

    const db = getSupabaseQueryClient();
    const result = await db.exec(
      "SELECT id, email, username, verified, created_at, referral_code FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Auto-generate referral code if missing
    let referralCode = user.referral_code;
    if (!referralCode) {
      referralCode = generateReferralCode();
      try {
        await db.exec(
          "UPDATE users SET referral_code = $1 WHERE id = $2",
          [referralCode, user.id]
        );
      } catch (err) {
        console.warn("Failed to auto-generate referral code:", err);
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.username,
        current_rank: "Bronze",
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

    const db = getSupabaseQueryClient();
    const result = await db.exec(
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
      await db.exec(
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

    const db = getSupabaseQueryClient();

    // Find and validate token
    const tokenResult = await db.exec(
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
    await db.exec(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, resetTokenData.user_id]
    );

    // Mark token as used
    await db.exec(
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
