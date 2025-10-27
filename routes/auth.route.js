const express = require("express");
const route = express.Router();

// Auth controller
const AuthController = require("../controllers/auth.controller");

// Registration Route
route.post("/register", AuthController.register);

// Registration Route
route.post("/login", AuthController.login);

// Registration Route
route.post("/forgot-password", AuthController.forgotPassword);

// Registration Route
route.post("/reset-password/:token", AuthController.resetPassword);

// Logout Route
route.post("/logout", AuthController.logout);

module.exports = route;
