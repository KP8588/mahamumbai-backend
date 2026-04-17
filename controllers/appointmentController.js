const db = require("../db");

// Create Appointment
exports.createAppointment = async (req, res) => {

  try {

    const {
      full_name,
      mobile_number,
      service_required,
      preferred_date,
      preferred_time
    } = req.body;

    const result = await db.query(
      `INSERT INTO appointments
      (full_name, mobile_number, service_required, preferred_date, preferred_time)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [
        full_name,
        mobile_number,
        service_required,
        preferred_date,
        preferred_time
      ]
    );

    res.json({
      success: true,
      appointment: result.rows[0]
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

};


// Get All Appointments
exports.getAppointments = async (req, res) => {

  try {

    const result = await db.query(
      "SELECT * FROM appointments ORDER BY created_at DESC"
    );

    res.json(result.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      success: false
    });

  }

};