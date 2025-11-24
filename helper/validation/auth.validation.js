const Joi = require("joi");

const name = Joi.string().min(3).max(50).required();
const email = Joi.string().email().required();
const password = Joi.string().min(6).required();
const mobile = Joi.string()
  .pattern(/^[0-9]{10}$/)
  .required();

const SignUpSchema = Joi.object({
  role: Joi.string().valid("customer", "provider").required(),
  name,
  email,
  mobile,
  password,
});

const LogInSchema = Joi.object({
  email,
  password,
});

const ForgotPasswordSchema = Joi.object({
  email,
});

const ResetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.any().valid(Joi.ref("newPassword")).required(),
});

module.exports = {
  SignUpSchema,
  LogInSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
};
