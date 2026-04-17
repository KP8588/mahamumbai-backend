const express = require("express");
const pool = require("../db");
const router = express.Router();

// Book appointment
router.post("/appointments", async (req, res) => {
  try {
    const { name, mobile, service, preferred_date, preferred_time, message } = req.body;

    if (!name?.trim() || !mobile?.trim() || !service?.trim()) {
      return res.status(400).json({ message: "Name, mobile, and service are required" });
    }

    const result = await pool.query(
      `INSERT INTO appointments (name, mobile, service, preferred_date, preferred_time, message)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), mobile.trim(), service.trim(), preferred_date || null, preferred_time || null, message || null]
    );

    res.status(201).json({
      message: "Appointment booked successfully! We will contact you shortly.",
      appointment: result.rows[0]
    });
  } catch (err) {
    console.error("Appointment error:", err);
    res.status(500).json({ message: "Failed to book appointment" });
  }
});

// Get all appointments (admin)
router.get("/appointments", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM appointments ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
