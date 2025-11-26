const prisma = require("../prismaClient");
const { lemmatizer } = require("lemmatizer");

// VALIDATION SCHEMA
const {
  businessProfileSchema,
  serviceProfileSchema,
  slotProfileSchema,
} = require("../helper/validation/provider.validation");
const { sendMail } = require("../utils/sendmail");
const {
  slotBookingStatusTemplate,
} = require("../helper/mail-tamplates/tamplates");

// ==================================== BUSINESS ====================================
const createBusiness = async (req, res) => {
  const userId = req.user.id;

  const { error, value } = businessProfileSchema.validate(req.body);

  if (error) {
    return res.status(422).json({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    const isBusinessExist = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    const allBusinesses = await prisma.BusinessProfile.findMany();

    const isBusinessEmailExist = allBusinesses.some((business) => {
      return (
        business.contactEmail === value.contactEmail ||
        business.phoneNumber === value.phoneNumber
      );
    });

    if (isBusinessEmailExist || isBusinessExist) {
      return res.status(400).json({
        success: false,
        msg: "Business already exists!",
      });
    }

    // check address is exist or not
    const isAddressExist = await prisma.Address.findFirst({
      where: { userId },
    });

    if (!isAddressExist) {
      return res.status(400).json({
        success: false,
        msg: "Address not found. Please add your address first.",
      });
    }

    console.log("Business Type Id", value.businessCategoryId);
    const businessCategory = await prisma.Businesscategory.findUnique({
      where: { id: value.businessCategoryId },
    });

    if (!businessCategory) {
      return res.status(400).json({
        success: false,
        msg: "Invalid Business Type. Please select a valid business category.",
      });
    }

    const { businessCategoryId, ...businessData } = value;
    const newBusiness = await prisma.BusinessProfile.create({
      data: {
        ...businessData,
        userId,
        businessCategoryId: businessCategory.id,
      },
    });

    return res.status(201).json({
      success: true,
      msg: "Business created successfully.",
      business: newBusiness,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not create business.",
      err,
    });
  }
};

const getBusinessProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const businessDetails = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });
    return res.status(200).json({
      success: true,
      msg: "Business details fetched successfully.",
      business: businessDetails,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch business details.",
    });
  }
};

const updateBusiness = async (req, res) => {
  const userId = req.user.id;
  const { error, value } = businessProfileSchema.validate(req.body);

  if (error) {
    return res.status(422).json({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    const businessDetails = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!businessDetails) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found.",
      });
    }

    // Check if there are any actual changes
    const hasChanges = Object.keys(value).some((key) => {
      const newValue = value[key];
      const oldValue = businessDetails[key];
      return Array.isArray(newValue)
        ? JSON.stringify(newValue.sort()) !== JSON.stringify(oldValue.sort())
        : newValue !== oldValue;
    });

    if (!hasChanges) {
      return res.status(200).json({
        success: true,
        msg: "No new changes detected.",
      });
    }

    const updatedBusiness = await prisma.BusinessProfile.update({
      where: { userId },
      data: value,
    });

    return res.status(200).json({
      success: true,
      msg: "Business profile updated successfully.",
      business: updatedBusiness,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not update business profile.",
      err,
    });
  }
};

const deleteBusiness = async (req, res) => {
  const userId = req.user.id;

  try {
    const businessDetails = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!businessDetails) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found.",
      });
    }

    await prisma.BusinessProfile.delete({
      where: { userId },
    });

    return res.status(200).json({
      success: true,
      msg: "Business profile deleted successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not delete business profile.",
    });
  }
};

// ==================================== BUSINESS CATEGORY ====================================
const getAllBusinessCategory = async (req, res) => {
  const businessCategory = await prisma.Businesscategory.findMany();
  return res.status(200).json({
    success: true,
    msg: "Business Category fetched successfully.",
    count: businessCategory.length,
    businessCategory,
  });
};

const createBusinessCategory = async (req, res) => {
  const { name } = req.body;

  if (!name.trim() || name === "" || name.length < 3) {
    return res.status(400).json({
      success: false,
      msg: "Name is required and must be at least 3 characters long.",
    });
  }

  try {
    // Helper function to normalize a string into root words
    const normalize = (text) =>
      text
        .toLowerCase()
        .split(/\s+/) // split by space
        .map((word) => lemmatizer(word))
        .join(" ");

    const existingCategories = await prisma.Businesscategory.findMany();

    const inputNameNormalized = normalize(name.trim());

    // Find similar categories based on root words
    const similarCategories = existingCategories.filter((cat) => {
      const catNameNormalized = normalize(cat.name);
      return (
        inputNameNormalized.includes(catNameNormalized) ||
        catNameNormalized.includes(inputNameNormalized)
      );
    });

    if (similarCategories.length > 0) {
      return res.status(200).json({
        success: false,
        msg: "We found similar business categories. Please select from the suggestions.",
        suggestions: similarCategories.map((c) => c.name),
      });
    }

    const newCategory = await prisma.Businesscategory.create({
      data: { name: name.toLowerCase(), createdBy: req.user.id },
    });

    return res.status(201).json({
      success: true,
      msg: "Business category created successfully.",
      category: newCategory,
    });
  } catch (error) {
    console.error("Business category create :", error);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not create business category.",
    });
  }
};

// ==================================== SERVICE ====================================
const createService = async (req, res) => {
  const userId = req.user.id;

  // Validate request body
  const { error, value } = serviceProfileSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(422).json({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    // Check if business profile exists for the provider
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found. Please create one first.",
      });
    }

    // check address is exist or not
    const isAddressExist = await prisma.Address.findFirst({
      where: { userId },
    });

    if (!isAddressExist) {
      return res.status(404).json({
        success: false,
        msg: "Address not found. Please add your address first.",
      });
    }

    // Limit check — a provider can only create 5 services
    const existingServiceCount = await prisma.Service.count({
      where: { businessProfileId: business.id },
    });

    if (existingServiceCount >= 5) {
      return res.status(507).json({
        success: false,
        msg: "You have reached the maximum limit of 5 services.",
      });
    }

    // Prevent duplicate service names under the same business
    const duplicateService = await prisma.Service.findFirst({
      where: {
        businessProfileId: business.id,
        name: value.name,
      },
    });

    if (duplicateService) {
      return res.status(400).json({
        success: false,
        msg: "A service with this name already exists under your business.",
      });
    }

    // Create the new service
    const newService = await prisma.Service.create({
      data: {
        ...value,
        businessProfileId: business.id,
        businessCategoryId: business.businessCategoryId,
      },
    });

    return res.status(201).json({
      success: true,
      msg: "Service created successfully.",
      service: newService,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not create service.",
    });
  }
};

const getAllServices = async (req, res) => {
  const userId = req.user.id;

  try {
    // Find business profile of the provider
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found for this user.",
      });
    }

    // Get all services for this business
    const services = await prisma.Service.findMany({
      where: { businessProfileId: business.id },
      orderBy: { createdAt: "desc" },
    });

    // Return response
    if (services.length === 0) {
      return res.status(200).json({
        success: true,
        msg: "No services found for this business.",
        count: 0,
        services: [],
      });
    }

    return res.status(200).json({
      success: true,
      msg: "Services fetched successfully.",
      count: services.length,
      services,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch services.",
    });
  }
};

const updateService = async (req, res) => {
  const userId = req.user.id;
  const { serviceId } = req.params;

  const { error, value } = serviceProfileSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    // Check if the user's business profile exists
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found for this user.",
      });
    }

    // Find the service that belongs to this business
    const existingService = await prisma.Service.findFirst({
      where: {
        id: serviceId,
        businessProfileId: business.id,
      },
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        msg: "Service not found or does not belong to your business.",
      });
    }

    // Check if another service with the same name already exists
    if (value.name && value.name !== existingService.name) {
      const duplicateService = await prisma.Service.findFirst({
        where: {
          businessProfileId: business.id,
          name: value.name,
          NOT: { id: serviceId },
        },
      });

      if (duplicateService) {
        return res.status(400).json({
          success: false,
          msg: "A service with this name already exists under your business.",
        });
      }
    }

    // Compare the new data with existing one to detect any actual change
    const hasChanges = Object.keys(value).some((key) => {
      const newVal = value[key];
      const oldVal = existingService[key];

      if (Array.isArray(newVal)) {
        return (
          JSON.stringify(newVal.sort()) !==
          JSON.stringify((oldVal || []).sort())
        );
      } else if (typeof newVal === "boolean") {
        return newVal !== Boolean(oldVal);
      } else if (typeof newVal === "number") {
        return Number(newVal) !== Number(oldVal);
      } else {
        return newVal !== oldVal;
      }
    });

    // If nothing has changed, skip unnecessary DB update
    if (!hasChanges) {
      return res.status(200).json({
        success: true,
        msg: "No new changes detected. Service not updated.",
        service: existingService,
      });
    }

    // Update the service only if data has changed
    const updatedService = await prisma.Service.update({
      where: { id: serviceId },
      data: {
        ...value,
      },
    });

    return res.status(200).json({
      success: true,
      msg: "Service updated successfully.",
      service: updatedService,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not update service.",
    });
  }
};

const deleteService = async (req, res) => {
  const userId = req.user.id;
  const { serviceId } = req.params;

  try {
    // Check if the user's business profile exists
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found for this user.",
      });
    }

    // Find the service that belongs to this business
    const existingService = await prisma.Service.findFirst({
      where: {
        id: serviceId,
        businessProfileId: business.id,
      },
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        msg: "Service not found or does not belong to your business.",
      });
    }

    // Delete the service
    await prisma.Service.delete({
      where: { id: serviceId },
    });

    return res.status(200).json({
      success: true,
      msg: "Service deleted successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not delete service.",
    });
  }
};

// ==================================== SLOT ====================================
const createSlot = async (req, res) => {
  const userId = req.user.id;

  // Validate input
  const { error, value } = slotProfileSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    // Check if provider's business profile exists
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found. Please create one first.",
      });
    }

    // Verify that the service exists and belongs to this business
    const service = await prisma.Service.findFirst({
      where: {
        id: value.serviceId,
        businessProfileId: business.id,
      },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        msg: "Service not found or does not belong to your business.",
      });
    }

    // date must be greater or equal to today
    const userSelectedDate = new Date(`${value.date}`)
      .toISOString()
      .split("T")[0];
    const currentDate = new Date().toISOString().split("T")[0];

    if (userSelectedDate < currentDate) {
      return res.status(400).json({
        success: false,
        msg: "Booking Date must be Today or later, not in the past",
      });
    }

    // Find all existing slots for this service on the same date
    const existingSlots = await prisma.Slot.findMany({
      where: {
        serviceId: value.serviceId,
        date: new Date(value.date),
      },
    });

    const userStartTime = value.startTime;
    const userEndTime = value.endTime;

    const slotTimeConflict = existingSlots.some((slot) => {
      const savedStartTime = slot.startTime;
      const savedEndTime = slot.endTime;

      return (
        (userStartTime < savedEndTime && userEndTime > savedStartTime) ||
        userStartTime === savedStartTime ||
        userEndTime === savedEndTime ||
        (userStartTime > savedStartTime && userEndTime < savedEndTime)
      );
    });

    if (slotTimeConflict) {
      return res.status(400).json({
        success: false,
        msg: "This time slot overlaps with an existing slot for the same service.",
      });
    }

    // Create slot
    const newSlot = await prisma.Slot.create({
      data: {
        date: new Date(value.date),
        startTime: value.startTime,
        endTime: value.endTime,
        serviceId: service.id,
        businessProfileId: business.id,
      },
    });

    return res.status(201).json({
      success: true,
      msg: "Slot created successfully.",
      slot: newSlot,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not create slot.",
    });
  }
};

const getAllSlotsByServiceId = async (req, res) => {
  const userId = req.user.id;
  const { serviceId } = req.params;
  try {
    // Check if provider's business profile exists
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found for this user.",
      });
    }

    // Verify that the service exists and belongs to this business
    const service = await prisma.Service.findFirst({
      where: {
        id: serviceId,
        businessProfileId: business.id,
      },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        msg: "Service not found or does not belong to your business.",
      });
    }

    const slots = await prisma.Slot.findMany({
      where: {
        serviceId: serviceId,
        businessProfileId: business.id,
      },
    });

    if (slots.length === 0) {
      return res.status(200).json({
        success: true,
        msg: "No slots found for this service.",
        count: 0,
        slots: [],
      });
    }

    return res.status(200).json({
      success: true,
      msg: "Slots fetched successfully.",
      count: slots.length,
      slots,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch slots.",
    });
  }
};

const deleteSlot = async (req, res) => {
  const userId = req.user.id;
  const { slotId } = req.params;

  try {
    // Check if provider's business profile exists
    const business = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business profile not found for this user.",
      });
    }

    // Find the slot that belongs to this
    const existingSlot = await prisma.Slot.findFirst({
      where: {
        id: slotId,
        businessProfileId: business.id,
      },
    });

    if (!existingSlot) {
      return res.status(404).json({
        success: false,
        msg: "Slot not found or does not belong to your business.",
      });
    }

    // Delete the slot
    await prisma.Slot.delete({
      where: { id: slotId },
    });

    return res.status(200).json({
      success: true,
      msg: "Slot deleted successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not delete slot.",
    });
  }
};

// ==================================== BOOKING ====================================
const bookingList = async (req, res) => {
  const userId = req.user.id;

  const businessProfile = await prisma.BusinessProfile.findUnique({
    where: { userId },
  });

  if (!businessProfile) {
    return res.status(404).json({
      success: false,
      msg: "Business profile not found for this user.",
    });
  }
  const businessId = businessProfile.id;

  const bookings = await prisma.Booking.findMany({
    where: {
      businessProfileId: businessId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (bookings.length === 0) {
    return res.status(200).json({
      success: true,
      msg: "No bookings found for this business.",
      count: 0,
      bookings: [],
    });
  }

  return res.status(200).json({
    success: true,
    msg: "Bookings fetched successfully.",
    count: bookings.length,
    bookings,
  });
};

const updateBookingStatus = async (req, res) => {
  // const userId = req.user.id;
  const { bookingId } = req.params;

  if (!bookingId) {
    return res.status(400).json({
      success: false,
      msg: "Booking ID is required.",
    });
  }

  let { status } = req.body;
  status = status.charAt(0).toUpperCase() + status.toLowerCase().slice(1);

  if (!status || status === "") {
    return res.status(400).json({
      success: false,
      msg: "Status is required.",
    });
  }

  try {
    const bookingDetails = await prisma.Booking.findUnique({
      where: { id: bookingId },
    });

    if (!bookingDetails) {
      return res.status(404).json({
        success: false,
        msg: "Booking not found.",
      });
    }

    if (status === bookingDetails.status) {
      return res.status(404).json({
        success: false,
        msg: "No new changes detected. Booking status not updated.",
      });
    }
    const updatedBooking = await prisma.Booking.update({
      where: { id: bookingId },
      data: { status },
    });

    // User who booked the service
    const user = await prisma.User.findUnique({
      where: { id: bookingDetails.userId },
    });

    // service booked by user
    const service = await prisma.Service.findUnique({
      where: { id: bookingDetails.serviceId },
    });

    // booked slot details
    const slot = await prisma.Slot.findUnique({
      where: { id: bookingDetails.slotId },
    });

    await sendMail({
      email: user.email,
      subject: "Booking Status Updated",
      template: slotBookingStatusTemplate(
        user.name,
        service.name,
        bookingDetails.createdAt,
        slot.startTime,
        slot.endTime,
        status
      ),
    });
    return res.status(200).json({
      success: true,
      msg: "Booking status updated successfully.",
      updatedBooking,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not update booking status.",
    });
  }
};

module.exports = {
  // BUSINESS
  createBusiness,
  getBusinessProfile,
  updateBusiness,
  deleteBusiness,

  // SERVICES
  getAllServices,
  createService,
  updateService,
  deleteService,

  // SLOTS
  createSlot,
  getAllSlotsByServiceId,
  deleteSlot,

  // BOOKING
  bookingList,
  updateBookingStatus,

  // BUSINESS CATEGORY
  getAllBusinessCategory,
  createBusinessCategory,
};
