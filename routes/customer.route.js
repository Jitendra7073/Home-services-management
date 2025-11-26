const express = require("express");
const route = express.Router();

// CONTROLLER
const CustomerController = require("../controllers/customer.controller");

// PROVIDERS
route.get("/providers", CustomerController.getAllProviders);
route.get("/providers/:providerId", CustomerController.getProviderById);

// SLOT BOOKING
route.post("/book-slot", CustomerController.bookSlot);
route.get("/bookings", CustomerController.getCustomerBookings);
route.patch("/bookings/:bookingId/cancel", CustomerController.cancelBooking);

module.exports = route;
