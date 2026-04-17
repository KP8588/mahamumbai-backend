// // Subscription logic is handled directly in routes/subscription.js
// const crypto = require("crypto");
// const pool = require("../db");

// exports.verifyPayment = async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       plan,
//       userId,
//     } = req.body;

//     // 🔐 Create signature
//     const body = razorpay_order_id + "|" + razorpay_payment_id;

//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Invalid signature" });
//     }

//     // ✅ Set expiry
//     let expiry;
//     if (plan === "monthly") {
//       expiry = "NOW() + INTERVAL '30 days'";
//     } else if (plan === "yearly") {
//       expiry = "NOW() + INTERVAL '365 days'";
//     }

//     // ✅ Update DB
//     await pool.query(
//       `UPDATE users 
//        SET plan=$1, subscription_expires_at=${expiry}
//        WHERE id=$2`,
//       [plan, userId]
//     );

//     return res.json({ success: true });

//   } catch (err) {
//     console.error("Verification error:", err);
//     res.status(500).json({ success: false });
//   }
// };








const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const crypto = require("crypto");

const router = express.Router();

// Razorpay init
function getRazorpay() {
  const Razorpay = require("razorpay");

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys not configured");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

const PLAN_AMOUNTS = {
  monthly: 5000,
  yearly: 40000,
};



// ───────────────── CREATE ORDER ─────────────────
router.post("/create-order", authMiddleware, async (req, res) => {
  try {
    const { plan_type } = req.body;

    if (!["monthly", "yearly"].includes(plan_type)) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: PLAN_AMOUNTS[plan_type],
      currency: "INR",
      receipt: `sub_${req.user.id}_${Date.now()}`,
      notes: {
        user_id: req.user.id.toString(),
        plan_type,
      },
    });

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});



// ───────────────── VERIFY PAYMENT ─────────────────
router.post("/verify-payment", authMiddleware, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_type,
    } = req.body;

    // ✅ Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment fields" });
    }

    // 🔐 Signature verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.log("❌ Signature mismatch");
      return res.status(400).json({ error: "Payment verification failed" });
    }

    console.log("✅ Payment verified");

    // 🧠 Set expiry
    let expiryQuery =
      plan_type === "yearly"
        ? "NOW() + INTERVAL '365 days'"
        : "NOW() + INTERVAL '30 days'";

    // ❗ Prevent duplicate activation
    const existing = await pool.query(
      `SELECT * FROM subscriptions 
       WHERE payment_id=$1`,
      [razorpay_payment_id]
    );

    if (existing.rows.length > 0) {
      return res.json({
        message: "Already processed",
        subscription: existing.rows[0],
      });
    }

    // 🧹 Expire old
    await pool.query(
      `UPDATE subscriptions SET status='expired' WHERE user_id=$1`,
      [req.user.id]
    );

    // ✅ Insert new
    const result = await pool.query(
      `INSERT INTO subscriptions 
      (user_id, plan_type, payment_id, order_id, status, start_date, expiry_date)
      VALUES ($1,$2,$3,$4,'active',NOW(),${expiryQuery})
      RETURNING *`,
      [
        req.user.id,
        plan_type,
        razorpay_payment_id,
        razorpay_order_id,
      ]
    );

    // 🔓 Unlock cards
    await pool.query(
      `UPDATE digital_cards SET is_locked=false WHERE user_id=$1`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Subscription activated 🎉",
      subscription: result.rows[0],
    });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});



// ───────────────── STATUS ─────────────────
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id=$1
       AND status='active'
       AND expiry_date > NOW()
       ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      active: result.rows.length > 0,
      subscription: result.rows[0] || null,
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;