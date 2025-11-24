const express = require("express");
const route = express.Router();

// CONTROLLER
const ProviderController = require("../controllers/provider.controller");

<<<<<<< HEAD
// ADDRESS ROUTES
route.route("/address")
    .post(ProviderController.addAddress)
    .delete(ProviderController.deleteAddress);

=======
>>>>>>> c159425d0b335aa35324500577fa1c6a1c6c306c
// BUSINESS ROUTES
route.route("/business")
    .get(ProviderController.getBusinessProfile)
    .post(ProviderController.createBusiness)
    .patch(ProviderController.updateBusiness)
    .delete(ProviderController.deleteBusiness);

<<<<<<< HEAD
// SERVICE ROUTES
=======
// SERVICE ROUTES   
>>>>>>> c159425d0b335aa35324500577fa1c6a1c6c306c
route.route("/service")
    .get(ProviderController.getAllServices)
    .post(ProviderController.createService);
route.route("/service/:serviceId")
    .patch(ProviderController.updateService)
    .delete(ProviderController.deleteService);


// SLOT ROUTES
route.get("/slot/:serviceId",ProviderController.getAllSlotsByServiceId);
route.post("/slot",ProviderController.createSlot);
route.delete("/slot/:slotId",ProviderController.deleteSlot);

<<<<<<< HEAD


module.exports = route;     
=======
// Booking Route
route.get("/booking",ProviderController.bookingList);
route.patch("/booking/:bookingId",ProviderController.updateBookingStatus);



 
module.exports = route;    
>>>>>>> c159425d0b335aa35324500577fa1c6a1c6c306c
