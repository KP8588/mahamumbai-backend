const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("../db");

const router = express.Router();
const otpStore = {};

// ================= GOOGLE STRATEGY =================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://mahamumbai-backend.onrender.com/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const picture = profile.photos?.[0]?.value || null;

          if (!email) return done(new Error("No email found"), null);

          let userResult = await pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email]
          );

          let user;

          if (userResult.rows.length === 0) {
            const newUser = await pool.query(
              `INSERT INTO users (name, email, password, avatar_url, google_id)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [name, email, "google_oauth", picture, profile.id]
            );
            user = newUser.rows[0];
          } else {
            user = userResult.rows[0];
          }

          return done(null, {
  id: user.id,
  name: user.name,
  email: user.email,
  avatar_url: user.avatar_url
});

        } catch (err) {
          console.error("Google Strategy Error:", err);
          return done(err, null);
        }
      }
    )
  );

  console.log("✅ Google OAuth configured");

} else {
  console.log("❌ Google OAuth NOT configured");
}

// ================= GOOGLE LOGIN =================
router.get("/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })(req, res, next);
});

// ================= GOOGLE CALLBACK =================
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth?error=google_failed`,
    session: false,
  }),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth?error=google_failed`);
      }

      const token = jwt.sign(
        { id: req.user.id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar_url: req.user.avatar_url || null
      }));

      res.redirect(
        `${process.env.FRONTEND_URL}/auth-success?token=${token}&user=${userData}`
      );

    } catch (err) {
      console.error("Google Callback Error:", err);
      res.redirect(`${process.env.FRONTEND_URL}/auth?error=server_error`);
    }
  }
);

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1,$2,$3) RETURNING *",
      [name, email, hashed]
    );

    const token = jwt.sign(
      { id: user.rows[0].id },
      process.env.JWT_SECRET
    );

    res.json({ token, user: user.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET
    );

    res.json({ token, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;