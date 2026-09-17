const Rajorpay = require('razorpay');
require('dotenv').config();

exports.instance = (process.env.RAZORPAY_KEY && process.env.RAZORPAY_SECRET)
    ? new Rajorpay({
        key_id: process.env.RAZORPAY_KEY,
        key_secret: process.env.RAZORPAY_SECRET
    })
    : null;

if (!exports.instance) {
    console.log('Razorpay keys not set - payments feature disabled');
}
