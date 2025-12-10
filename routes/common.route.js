const express = require("express");
const route = express.Router();

// controller
const commonRoutes = require("../controllers/common.controller");
const { checkAuthToken } = require("../middleware/checkTOken");

// CONTROLLER
const ProviderController = require("../controllers/provider.controller");

// Profile Route
route.get("/profile", checkAuthToken(), commonRoutes.getUserProfile);
route.get("/me/:token", commonRoutes.getMe);
route.delete("/profile/:userId", commonRoutes.deleteProfile);

// Address Routes
route
  .route("/address")
  .get(checkAuthToken(), commonRoutes.getAddress)
  .post(checkAuthToken(), commonRoutes.addAddress)
  .delete(checkAuthToken(), commonRoutes.deleteAddress);

// Business Category Routes
route
  .route("/business-category")
  .get(checkAuthToken(), ProviderController.getAllBusinessCategory);

module.exports = route;
