const express = require("express");
const route = express.Router();

<<<<<<< HEAD
// MiddleWare
const {IsCustomer} = require("../middleware/IsCustomer");
route.use(IsCustomer());

=======
>>>>>>> c159425d0b335aa35324500577fa1c6a1c6c306c
// CONTROLLER
const CustomerController = require("../controllers/customer.controller");

// USER PROFILE
route.get("/profile", CustomerController.getUserProfile);

// PROVIDERS
route.get("/providers", CustomerController.getAllProviders);
route.get("/providers/:providerId", CustomerController.getProviderById);

// SLOT BOOKING
route.post("/book-slot", CustomerController.bookSlot);
route.get("/bookings", CustomerController.getCustomerBookings);
route.patch("/bookings/:bookingId/cancel", CustomerController.cancelBooking);

module.exports = route;
