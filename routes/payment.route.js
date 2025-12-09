const express = require("express");
const route = express.Router();

// controller
const paymentRoute = require("../controllers/payment.controller");

// Customer Payment Route
route.post("/create-checkout-session", paymentRoute.customerPayment);

module.exports = route;
