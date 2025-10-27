const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const cookieParser = require("cookie-parser");

// Required Modules or Files
const ConnectDB = require("./config/database");
const { checkAuthToken } = require("./middleware/checkTOken");
const { checkUserRole } = require("./middleware/checkRole");


const CustomerRoute = require("./routes/customer.route");
const ProviderRoute = require("./routes/provider.route");
const AuthRoutes = require("./routes/auth.route");

// variables
const port = process.env.PORT || 8080;

// Middleware Setup
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Connect database
ConnectDB();

// Routes
app.use("/auth", AuthRoutes);
app.use(checkAuthToken());
app.use("/api/v1/customer", CustomerRoute);
app.use("/api/v1/provider", ProviderRoute);

// Start Server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
