const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto");

const router = express.Router();

// Razorpay is initialized lazily inside route handlers
// so it works even if .env is loaded after module imports
function getRazorpay() {
  const Razorpay = require("razorpay");
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys not configured in .env file");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

const PLAN_AMOUNTS = {
  monthly: 5000,   // ₹50 in paise
  yearly: 40000    // ₹400 in paise
};

// ─── CREATE RAZORPAY ORDER ────────────────────────────────────────────────────
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { plan_type } = req.body;

    if (!["monthly", "yearly"].includes(plan_type)) {
      return res.status(400).json({ error: "Invalid plan type. Must be 'monthly' or 'yearly'." });
    }

    const razorpay = getRazorpay();
    const amount = PLAN_AMOUNTS[plan_type];

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `sub_${req.user.id}_${Date.now()}`,
      notes: {
        user_id: req.user.id.toString(),
        plan_type
      }
    });

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("Create order error:", err.message);
    res.status(500).json({ error: err.message || "Failed to create payment order" });
  }
});

// ─── VERIFY PAYMENT & ACTIVATE ────────────────────────────────────────────────
router.post("/verify-payment", authMiddleware, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_type
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed - invalid signature" });
    }

    const expiryInterval = plan_type === "monthly"
      ? "INTERVAL '30 days'"
      : "INTERVAL '365 days'";

    // Deactivate old subscriptions for this user
    await pool.query(
      "UPDATE subscriptions SET status='expired' WHERE user_id=$1",
      [req.user.id]
    );

    // Create new active subscription
    const result = await pool.query(
      `INSERT INTO subscriptions
       (user_id, plan_type, payment_id, order_id, status, start_date, expiry_date)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW() + ${expiryInterval})
       RETURNING *`,
      [req.user.id, plan_type, razorpay_payment_id, razorpay_order_id]
    );

    // Unlock all cards for this user
    await pool.query(
      "UPDATE digital_cards SET is_locked=false WHERE user_id=$1",
      [req.user.id]
    );

    res.json({
      message: "Payment verified. Subscription activated!",
      subscription: result.rows[0]
    });

  } catch (err) {
    console.error("Verify payment error:", err.message);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

// ─── CHECK SUBSCRIPTION STATUS (token-based) ──────────────────────────────────
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id=$1
       AND status='active'
       AND expiry_date > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ active: false, subscription: null });
    }

    res.json({ active: true, subscription: result.rows[0] });

  } catch (err) {
    console.error("Status check error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── LEGACY ROUTE (used by some older frontend calls) ─────────────────────────
router.get("/status/:user_id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id=$1
       AND status='active'
       AND expiry_date > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [req.params.user_id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
