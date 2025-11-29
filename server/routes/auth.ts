import { Router, Request, Response } from "express";
import { supabase } from "../utils/postgres";
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

    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();

    if (existingError) {
      console.error('[Auth] Error checking existing user:', existingError);
      return res.status(500).json({ error: existingError.message });
    }

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);
    const refCode = generateReferralCode();

    // Check referrer if provided
    let refById: string | null = null;
    if (data.ref_by) {
      const { data: referrer, error: referrerError } = await supabase
        .from('users')
        .select('id')
        .eq('username', data.ref_by)
        .maybeSingle();

      if (referrerError) {
        console.error('[Auth] Error fetching referrer:', referrerError);
      }

      if (referrer) {
        refById = referrer.id;
      }
    }

    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        email: data.email,
        password_hash: passwordHash,
        username: data.full_name,
        verified: false,
        referral_code: refCode,
        ref_by: refById,
      })
      .select('id, email, username, referral_code')
      .single();

    if (userInsertError || !newUser) {
      console.error('[Auth] Failed to create user:', userInsertError);
      return res.status(400).json({ error: "Failed to create user" });
    }
    console.log("[Auth] User created:", newUser.id);

    await supabase.from('wallets').insert({ user_id: newUser.id, usdt_balance: 0 });

    // Create permanent deposit addresses for TRC20 and BEP20
    try {
      const trc20Address = await createPermanentDepositAddress(newUser.id, 'TRC20');
      await supabase.from('deposit_addresses').insert({
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
      await supabase.from('deposit_addresses').insert({
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

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', data.email)
      .maybeSingle();

    if (fetchError || !user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

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

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, username, verified, created_at, referral_code')
      .eq('id', decoded.id)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Auto-generate referral code if missing
    let referralCode = user.referral_code;
    if (!referralCode) {
      referralCode = generateReferralCode();
      try {
        await supabase
          .from('users')
          .update({ referral_code: referralCode })
          .eq('id', user.id);
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

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user) {
      // Don't leak whether email exists - always return success
      return res.json({
        success: true,
        message: "If email exists, reset link sent",
      });
    }
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiration

    console.log("[FORGOT PASSWORD] Generated token for user:", user.id, "email:", email);

    // Store token in database
    try {
      const { error: tokenError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token: resetToken,
          expires_at: expiresAt.toISOString(),
        });

      if (tokenError) {
        throw tokenError;
      }
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

    const { data: resetTokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !resetTokenData) {
      console.error("[RESET PASSWORD] Token not found");
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

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
    await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', resetTokenData.user_id);

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

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
