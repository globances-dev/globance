import { Router } from "express";

const router = Router();

router.all("*", (req, res) => {
  res.json({
    success: false,
    message: "PostgreSQL backend is disabled in Supabase mode",
  });
});

export default router;
