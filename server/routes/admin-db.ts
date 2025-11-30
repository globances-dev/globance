import { Router } from "express";

const router = Router();

// Admin DB endpoints removed after PostgreSQL deprecation
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Admin DB endpoints are disabled in Supabase mode."
  });
});

export default router;
