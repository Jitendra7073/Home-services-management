const express = require("express");
const route = express.Router();

// controller
const commonRoutes = require("../controllers/common.controller");

// Profile Route
route.get("/profile", commonRoutes.getUserProfile);

// Address Routes
route
  .route("/address")
  .post(commonRoutes.addAddress)
  .delete(commonRoutes.deleteAddress);

module.exports = route;
