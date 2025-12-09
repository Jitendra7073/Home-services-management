const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const cookieParser = require("cookie-parser");

const ConnectDB = require("./config/database");
const { checkAuthToken } = require("./middleware/checkTOken");
const { RoleBasedAccess } = require("./middleware/checkRole");

const CustomerRoute = require("./routes/customer.route");
const ProviderRoute = require("./routes/provider.route");
const AuthRoutes = require("./routes/auth.route");
const CommonRoute = require("./routes/common.route");
const PaymentRoute = require("./routes/payment.route");
const {
  stripeWebhookHandler,
} = require("./controllers/stripeWebHooks.controller");

const port = process.env.PORT || 5000;

app.post(
  "/api/v1/payment/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Connect DB
ConnectDB();

app.use("/auth", AuthRoutes);
app.use("/api/v1", CommonRoute);
app.use(checkAuthToken());
app.use("/api/v1/payment", RoleBasedAccess("customer"), PaymentRoute);
app.use("/api/v1/customer", RoleBasedAccess("customer"), CustomerRoute);
app.use("/api/v1/provider", RoleBasedAccess("provider"), ProviderRoute);

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
