// require("dotenv").config(); // MUST be first line before any other require
// const express = require("express");
// const cors = require("cors");
// const session = require("express-session");
// const passport = require("passport");

// const authRoutes = require("./routes/auth");
// const cardRoutes = require("./routes/cards");
// const subscriptionRoutes = require("./routes/subscription");
// const appointmentRoutes = require("./routes/appointments");

// const app = express();

// // ─── CORS ─────────────────────────────────────────────────────────────────────
// app.use(cors({
//   origin: process.env.FRONTEND_URL || "http://localhost:5173",
//   credentials: true,
// }));

// // ─── BODY PARSERS ─────────────────────────────────────────────────────────────
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // ─── SESSION (needed for passport) ───────────────────────────────────────────
// app.use(session({
//   secret: process.env.SESSION_SECRET || "fallback_secret_change_this",
//   resave: false,
//   saveUninitialized: false,
//   cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
// }));

// // ─── PASSPORT ─────────────────────────────────────────────────────────────────
// app.use(passport.initialize());
// app.use(passport.session());

// // ─── STATIC FILES ─────────────────────────────────────────────────────────────
// app.use("/uploads", express.static("uploads"));

// // ─── TEST ROUTE ───────────────────────────────────────────────────────────────
// app.get("/api", (req, res) => {
//   res.json({ message: "Maha Mumbai Connect API running ✅" });
// });

// // ─── ROUTES ───────────────────────────────────────────────────────────────────
// app.use("/api/auth", authRoutes);
// app.use("/api/cards", cardRoutes);
// app.use("/api/subscription", subscriptionRoutes);
// app.use("/api", appointmentRoutes);

// // ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error("❌ Unhandled error:", err.message);
//   console.error(err.stack);
//   res.status(500).json({ message: "Internal server error" });
// });

// // ─── START ────────────────────────────────────────────────────────────────────
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`\n✅ Server running on http://localhost:${PORT}`);
//   console.log(`✅ Frontend expected at: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
//   console.log(`✅ Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? "Configured" : "Not configured (optional)"}`);
//   console.log(`✅ Email/OTP: ${process.env.EMAIL_USER ? "Configured" : "Dev mode (OTP printed to console)"}`);
//   console.log(`✅ Razorpay: ${process.env.RAZORPAY_KEY_ID ? "Configured" : "Not configured (optional)"}\n`);
// });







require("dotenv").config(); // MUST be first

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const path = require("path");

// ─── ROUTES ─────────────────────────────────────────
const authRoutes = require("./routes/auth");
const cardRoutes = require("./routes/cards");
const subscriptionRoutes = require("./routes/subscription");
const appointmentRoutes = require("./routes/appointments");

const app = express();



// ─── CORS (IMPORTANT FIX) ───────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);



// ─── BODY PARSER ───────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// ─── SESSION (PASSPORT) ────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_this_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // change to true in production (https)
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);



// ─── PASSPORT INIT ─────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());



// ─── STATIC FILES ──────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));



// ─── HEALTH CHECK ROUTE ────────────────────────────
app.get("/api", (req, res) => {
  res.json({
    status: "OK",
    message: "Maha Mumbai Connect API running 🚀",
  });
});



// ─── ROUTES ────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api", appointmentRoutes);



// ─── 404 HANDLER ───────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});



// ─── GLOBAL ERROR HANDLER ──────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.message);
  console.error(err.stack);

  res.status(500).json({
    message: "Internal server error",
  });
});



// ─── START SERVER ──────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(
    `🌐 Frontend: ${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }`
  );
  console.log(
    `🔐 Google OAuth: ${
      process.env.GOOGLE_CLIENT_ID ? "Configured" : "Not configured"
    }`
  );
  console.log(
    `📧 Email/OTP: ${
      process.env.EMAIL_USER ? "Configured" : "Dev mode"
    }`
  );
  console.log(
    `💳 Razorpay: ${
      process.env.RAZORPAY_KEY_ID ? "Configured" : "Not configured"
    }\n`
  );
});