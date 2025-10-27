const jwt = require("jsonwebtoken");

// Generate a JWT Token for login user
const assignToken = (user) => {
  const payload = {
    id: user.id,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn: "7d",
  });
  return token;
};

// Verify the user Token
const verifyToken = (token) => {
  const user = jwt.verify(token, process.env.JWT_SECRET_KEY);
  return user;
};

module.exports = {
  assignToken,
  verifyToken,
};
