const jwt = require("jsonwebtoken")
const nodemailer = require("nodemailer")

let otpStore = {}

// SEND OTP
exports.sendOTP = async (req,res)=>{

const {email} = req.body

const otp = Math.floor(100000 + Math.random()*900000)

otpStore[email] = otp

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}
})

await transporter.sendMail({
from:process.env.EMAIL_USER,
to:email,
subject:"Your Login OTP",
text:`Your OTP is ${otp}`
})

res.json({
message:"OTP sent to email"
})
}


// VERIFY OTP
exports.verifyOTP = (req,res)=>{

const {email,otp} = req.body

if(otpStore[email] == otp){

const token = jwt.sign(
{email},
process.env.JWT_SECRET,
{expiresIn:"1d"}
)

return res.json({
message:"Login successful",
token
})
}

res.status(400).json({
message:"Invalid OTP"
})
}