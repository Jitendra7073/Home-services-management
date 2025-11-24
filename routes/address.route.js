const express = require("express");
const route = express.Router();

// CONTROLLER
const AddressController = require("../controllers/address.controller")

// ADDRESS ROUTES
route.route("/")
    .post(AddressController.addAddress)
    .delete(AddressController.deleteAddress);

module.exports = route;  