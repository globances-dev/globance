// --- REMOVE THESE ---
/*
const DB_TO_CONFIG_ID = { ... }
const CONFIG_TO_DB_ID = { ... }
*/

// ✔ Keep PACKAGES_CONFIG from referral.ts

router.post("/buy", authMiddleware, async (req: any, res: Response) => {
  try {
    console.log("[BUY_PACKAGE] Starting purchase flow");

    const { package_id, amount } = z
      .object({
        package_id: z.string(),
        amount: z.number().optional(),
      })
      .parse(req.body);

    console.log("[BUY_PACKAGE] Raw package_id:", package_id);

    // Always use string IDs
    const configId = package_id.trim().toLowerCase();

    // Get package config
    const pkgConfig = PACKAGES_CONFIG.find((p) => p.id === configId);
    if (!pkgConfig) {
      console.log("[BUY_PACKAGE] Package config not found:", configId);
      return res.status(404).json({ error: "Package not found" });
    }

    const investmentAmount = amount || pkgConfig.min_invest;

    if (investmentAmount < pkgConfig.min_invest) {
      return res.status(400).json({
        error: `Minimum investment is ${pkgConfig.min_invest} USDT`,
      });
    }

    const pool = getPostgresPool();

    // Wallet balance
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

    // Create purchase using STRING package_id
    console.log("[BUY_PACKAGE] Inserting purchase with:", {
      user_id: req.user.id,
      package_id: configId, // <-- FIXED
      amount: investmentAmount,
    });

    const insertResult = await pool.query(
      `INSERT INTO purchases (user_id, package_id, amount, status, created_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)
       RETURNING id`,
      [req.user.id, configId, investmentAmount]
    );

    const purchase = insertResult.rows[0];

    // Deduct balance
    await pool.query(
      "UPDATE wallets SET usdt_balance = usdt_balance - $1 WHERE user_id = $2",
      [investmentAmount, req.user.id]
    );

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

