const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/cards";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim() + "-" + Date.now().toString(36);
};

// ─── CHECK SUBSCRIPTION ───────────────────────────────────────────────────────
async function hasActiveSubscription(userId) {
  const result = await db.query(
    `SELECT id FROM subscriptions
     WHERE user_id=$1 AND status='active' AND expiry_date > NOW()
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

// ─── CREATE / UPDATE CARD ─────────────────────────────────────────────────────
router.post("/save",
  authMiddleware,
  upload.fields([
    { name: "profile_photo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "background_image", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const data = req.body;

      if (!data.full_name?.trim()) {
        return res.status(400).json({ error: "Full name is required" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      let profilePhotoUrl = data.profile_photo_url || null;
      let logoUrl = data.logo_url || null;
      let bgUrl = data.background_image_url || null;

      if (req.files?.profile_photo?.[0]) {
        profilePhotoUrl = `${baseUrl}/uploads/cards/${req.files.profile_photo[0].filename}`;
      }
      if (req.files?.logo?.[0]) {
        logoUrl = `${baseUrl}/uploads/cards/${req.files.logo[0].filename}`;
      }
      if (req.files?.background_image?.[0]) {
        bgUrl = `${baseUrl}/uploads/cards/${req.files.background_image[0].filename}`;
      }

      const isSubscribed = await hasActiveSubscription(userId);
      const isLocked = !isSubscribed;

      // Check if card exists for this user
      const existing = await db.query(
        "SELECT id, slug FROM digital_cards WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
        [userId]
      );

      let card;

      if (existing.rows.length > 0) {
        // Update existing card
        const result = await db.query(
          `UPDATE digital_cards SET
            full_name=$1, designation=$2, company_name=$3, phone=$4, whatsapp=$5,
            email=$6, website=$7, address=$8, about=$9, selected_theme=$10,
            profile_photo_url=$11, logo_url=$12, background_image_url=$13,
            social_links=$14, is_locked=$15, updated_at=NOW()
           WHERE id=$16 AND user_id=$17
           RETURNING *`,
          [
            data.full_name, data.designation || null, data.company_name || null,
            data.phone || null, data.whatsapp || null, data.email || null,
            data.website || null, data.address || null, data.about || null,
            data.selected_theme || "minimal-elegant",
            profilePhotoUrl, logoUrl, bgUrl,
            JSON.stringify(data.social_links || {}), isLocked,
            existing.rows[0].id, userId
          ]
        );
        card = result.rows[0];
      } else {
        // Create new card
        const slug = generateSlug(data.full_name);
        const result = await db.query(
          `INSERT INTO digital_cards
            (user_id, slug, full_name, designation, company_name, phone, whatsapp, email, website,
             address, about, selected_theme, profile_photo_url, logo_url, background_image_url,
             social_links, is_locked)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING *`,
          [
            userId, slug, data.full_name, data.designation || null, data.company_name || null,
            data.phone || null, data.whatsapp || null, data.email || null, data.website || null,
            data.address || null, data.about || null, data.selected_theme || "minimal-elegant",
            profilePhotoUrl, logoUrl, bgUrl,
            JSON.stringify(data.social_links || {}), isLocked
          ]
        );
        card = result.rows[0];
      }

      res.json({
        message: isLocked ? "Card saved. Subscribe to unlock sharing." : "Card saved successfully!",
        card,
        is_locked: isLocked
      });

    } catch (err) {
      console.error("Save card error:", err);
      res.status(500).json({ error: "Failed to save card" });
    }
  }
);

// ─── GET MY CARDS ─────────────────────────────────────────────────────────────
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM digital_cards WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Legacy route
router.get("/user/:user_id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM digital_cards WHERE user_id=$1 ORDER BY created_at DESC",
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET PUBLIC CARD BY SLUG ──────────────────────────────────────────────────
router.get("/public/:slug", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM digital_cards WHERE slug=$1",
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Card not found" });
    }

    const card = result.rows[0];

    // Check subscription
    const sub = await db.query(
      `SELECT id FROM subscriptions WHERE user_id=$1 AND status='active' AND expiry_date > NOW() LIMIT 1`,
      [card.user_id]
    );

    const isActive = sub.rows.length > 0;
    card.is_locked = !isActive;

    res.json(card);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE CARD ──────────────────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM digital_cards WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]
    );
    res.json({ message: "Card deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
