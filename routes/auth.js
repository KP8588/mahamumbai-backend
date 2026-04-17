const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("../db");

const router = express.Router();
const otpStore = {};

// ─── GOOGLE STRATEGY SETUP ────────────────────────────────────────────────────
// Only register if credentials exist in .env
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        // ✅ FIXED: properly define avatar
        const picture = profile.photos?.[0]?.value || null;

        if (!email) {
          return done(new Error("No email found in Google profile"), null);
        }

        const existing = await pool.query(
          "SELECT * FROM users WHERE email=$1",
          [email]
        );

        let user;

        if (existing.rows.length === 0) {
          // ✅ FIXED: correct columns count
          const newUser = await pool.query(
            `INSERT INTO users (name, email, password, avatar_url, google_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, email, "google_oauth", picture, profile.id]
          );

          user = newUser.rows[0];
        } else {
          user = existing.rows[0];

          // ✅ Update avatar if missing
          if (picture && !user.avatar_url) {
            await pool.query(
              "UPDATE users SET avatar_url=$1 WHERE id=$2",
              [picture, user.id]
            );
          }
        }

        return done(null, {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url || picture,
        });
      } catch (err) {
        console.error("Google strategy error:", err);
        return done(err, null);
      }
    }
  )
);

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
  console.log("✅ Google OAuth configured");
} else {
  console.log("⚠️  Google OAuth not configured (GOOGLE_CLIENT_ID missing)");
}

// ─── NODEMAILER (only if email credentials exist) ────────────────────────────
async function sendOtpEmail(email, otp) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n📧 DEV MODE - OTP for ${email} : ${otp}\n`);
    return;
  }
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: `"Maha Mumbai Connect" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Login OTP – Maha Mumbai Connect",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:40px 20px;background:#f8fafc;">
        <div style="background:white;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <h1 style="color:#1e3a5f;text-align:center;font-size:22px;margin-bottom:24px;">🔐 Your One-Time Password</h1>
          <p style="color:#4b5563;text-align:center;">Use this code to log in to Maha Mumbai Connect.</p>
          <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <span style="color:white;font-size:42px;font-weight:bold;letter-spacing:12px;">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;">Valid for <strong>10 minutes</strong>. Do not share with anyone.</p>
        </div>
      </div>
    `,
  });
}

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Full name is required" });
    if (!email?.trim()) return res.status(400).json({ message: "Email is required" });
    if (!password?.trim()) return res.status(400).json({ message: "Password is required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format" });

    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email.toLowerCase().trim()]);
    if (exists.rows.length > 0) return res.status(400).json({ message: "An account with this email already exists" });

    const hashed = await bcrypt.hash(password, 12);
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING id, name, email",
      [name.trim(), email.toLowerCase().trim(), hashed]
    );

    const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim()) return res.status(400).json({ message: "Email is required" });
    if (!password?.trim()) return res.status(400).json({ message: "Password is required" });

    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "No account found with this email. Please register first." });
    }

    const user = result.rows[0];

    if (user.password === "google_oauth") {
      return res.status(400).json({ message: "This account uses Google Sign-In. Please click 'Continue with Google'." });
    }
    if (user.password === "otp_login") {
      return res.status(400).json({ message: "This account uses OTP login. Please use the OTP tab." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Incorrect password. Please try again." });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url || null },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ─── SEND OTP ─────────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: "Email is required" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000;
    otpStore[email.toLowerCase().trim()] = { otp, expiry };

    await sendOtpEmail(email.toLowerCase().trim(), otp);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Send OTP error:", err.message);
    res.status(500).json({ message: "Failed to send OTP. Check your email settings in .env" });
  }
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email?.trim() || !otp?.trim()) return res.status(400).json({ message: "Email and OTP are required" });

    const key = email.toLowerCase().trim();
    const stored = otpStore[key];

    if (!stored) return res.status(400).json({ message: "OTP not found. Please request a new one." });
    if (Date.now() > stored.expiry) {
      delete otpStore[key];
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }
    if (stored.otp !== otp.trim()) return res.status(400).json({ message: "Incorrect OTP. Please try again." });

    delete otpStore[key];

    const existing = await pool.query("SELECT * FROM users WHERE email=$1", [key]);
    let user;

    if (existing.rows.length === 0) {
      const newUser = await pool.query(
        "INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING *",
        [email.split("@")[0], key, "otp_login"]
      );
      user = newUser.rows[0];
    } else {
      user = existing.rows[0];
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url || null },
    });
  } catch (err) {
    console.error("Verify OTP error:", err.message);
    res.status(500).json({ message: "OTP verification failed. Please try again." });
  }
});

// ─── GOOGLE LOGIN ─────────────────────────────────────────────────────────────
router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const fe = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.redirect(`${fe}/auth?error=google_not_configured`);
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

// ─── GOOGLE CALLBACK ──────────────────────────────────────────────────────────
router.get("/google/callback",
  (req, res, next) => {
    const fe = process.env.FRONTEND_URL || "http://localhost:5173";
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${fe}/auth?error=google_failed`,
    })(req, res, next);
  },
  (req, res) => {
    try {
      const fe = process.env.FRONTEND_URL || "http://localhost:5173";

      if (!req.user) {
        return res.redirect(`${fe}/auth?error=google_failed`);
      }

      const token = jwt.sign(
        { id: req.user.id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar_url: req.user.avatar_url,
      }));

      res.redirect(`${fe}/auth-success?token=${token}&user=${userData}`);
    } catch (err) {
      console.error("Google callback error:", err.message);
      const fe = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${fe}/auth?error=google_failed`);
    }
  }
);

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      "SELECT id, name, email, avatar_url FROM users WHERE id=$1",
      [decoded.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;
