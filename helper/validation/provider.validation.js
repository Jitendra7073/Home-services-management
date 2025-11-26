const Joi = require("joi");

const businessProfileSchema = Joi.object({
  businessName: Joi.string().trim().min(3).max(50).required(),
  businessCategoryId: Joi.string().trim().required(),
  contactEmail: Joi.string().email().required(),
  phoneNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),
  websiteURL: Joi.string().uri(),
  socialLinks: Joi.array().items(Joi.string().uri()),
  isActive: Joi.boolean().default(true),
});

const serviceProfileSchema = Joi.object({
  name: Joi.string().min(5).max(50).required(),
  description: Joi.string().min(10).max(200).required(),
  durationInMinutes: Joi.number().positive().required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().valid("INR", "USD", "EUR").default("INR"),
  isActive: Joi.boolean().default(true),
  coverImage: Joi.array().items(Joi.string().uri()),
  images: Joi.array().items(Joi.string().uri()),
  averageRating: Joi.number().min(0).max(5).default(0),
  reviewCount: Joi.number().integer().min(0).default(0),
});

const slotProfileSchema = Joi.object({
  serviceId: Joi.string().required(),
  date: Joi.date().required(),
  startTime: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required(),
  endTime: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required(),
});

module.exports = {
  businessProfileSchema,
  serviceProfileSchema,
  slotProfileSchema,
};
