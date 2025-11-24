const express = require("express");
const route = express.Router();

// CONTROLLER
const ProviderController = require("../controllers/provider.controller");

// BUSINESS ROUTES
route
  .route("/business")
  .get(ProviderController.getBusinessProfile)
  .post(ProviderController.createBusiness)
  .patch(ProviderController.updateBusiness)
  .delete(ProviderController.deleteBusiness);

// SERVICE ROUTES
route
  .route("/service")
  .get(ProviderController.getAllServices)
  .post(ProviderController.createService);
route
  .route("/service/:serviceId")
  .patch(ProviderController.updateService)
  .delete(ProviderController.deleteService);

// SLOT ROUTES
route.get("/slot/:serviceId", ProviderController.getAllSlotsByServiceId);
route.post("/slot", ProviderController.createSlot);
route.delete("/slot/:slotId", ProviderController.deleteSlot);

// Booking Route
route.get("/booking", ProviderController.bookingList);
route.patch("/booking/:bookingId", ProviderController.updateBookingStatus);

module.exports = route;
