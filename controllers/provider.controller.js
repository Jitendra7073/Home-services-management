const prisma = require("../prismaClient");
// VALIDATION SCHEMA
const {
  businessProfileSchema,
  serviceProfileSchema,
  slotProfileSchema,
} = require("../helper/validation/provider.validation");
const { sendMail } = require("../utils/sendMail");
const {
  slotBookingStatusTemplate,
} = require("../helper/mail-tamplates/tamplates");

// CREATE BUSINESS
const createBusiness = async (req, res) => {
  const userId = req.user.id;

  const { error, value } = businessProfileSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    // CHECK IS BUSINESS EXISTS
    const isBusinessExist = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (isBusinessExist) {
      return res.status(400).send({
        success: false,
        msg: "Business already exist.",
      });
    }

    // check address is exist or not
    const isAddressExist = await prisma.Address.findFirst({
      where: { userId },
    });

    if (!isAddressExist) {
      return res.status(400).send({
        success: false,
        msg: "Address not found. Please add your address first.",
      });
    }

    const newBusiness = await prisma.BusinessProfile.create({
      data: { ...value, userId },
    });

    return res.status(201).send({
      success: true,
      msg: "Business created successfully.",
      business: newBusiness,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      msg: "Server Error: Could not create business.",
    });
  }
};

// READ BUSINESS
const getBusinessProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const businessDetails = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });
    return res.status(200).send({
      success: true,
      msg: "Business details fetched successfully.",
      business: businessDetails,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).send({
      success: false,
      msg: "Server Error: Could not fetch business details.",
    });
  }
};

// UPDATE BUSINESS
const updateBusiness = async (req, res) => {
  const userId = req.user.id;
  const { error, value } = businessProfileSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      success: false,
      msg: error.details.map((e) => e.message),
    });
  }

  try {
    const businessDetails = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!businessDetails) {
      return res.status(404).send({
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
      return res.status(200).send({
        success: true,
        msg: "No new changes detected.",
      });
    }

    const updatedBusiness = await prisma.BusinessProfile.update({
      where: { userId },
      data: value,
    });

    return res.status(200).send({
      success: true,
      msg: "Business profile updated successfully.",
      business: updatedBusiness,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      msg: "Server Error: Could not update business profile.",
    });
  }
};

// DELETE BUSINESS
const deleteBusiness = async (req, res) => {
  const userId = req.user.id;

  try {
    const businessDetails = await prisma.BusinessProfile.findUnique({
      where: { userId },
    });

    if (!businessDetails) {
      return res.status(404).send({
        success: false,
        msg: "Business profile not found.",
      });
    }

    await prisma.BusinessProfile.delete({
      where: { userId },
    });

    return res.status(200).send({
      success: true,
      msg: "Business profile deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      msg: "Server Error: Could not delete business profile.",
    });
  }
};

// ADD SERVICES
const createService = async (req, res) => {
  const userId = req.user.id;

  // Validate request body
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
      return res.status(400).send({
        success: false,
        msg: "Address not found. Please add your address first.",
      });
    }

    // Limit check — a provider can only create 5 services
    const existingServiceCount = await prisma.Service.count({
      where: { businessProfileId: business.id },
    });

    if (existingServiceCount >= 5) {
      return res.status(400).json({
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
        isActive: value.isActive === "true" || value.isActive === true,
        businessProfileId: business.id,
      },
    });

    return res.status(201).json({
      success: true,
      msg: "Service created successfully.",
      service: newService,
    });
  } catch (err) {
    console.error("Error creating service:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not create service.",
    });
  }
};

// READ SERVICES
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
    console.error("Error fetching services:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch services.",
    });
  }
};

// UPDATE SERVICE
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
        isActive: value.isActive === "true" || value.isActive === true,
      },
    });

    return res.status(200).json({
      success: true,
      msg: "Service updated successfully.",
      service: updatedService,
    });
  } catch (err) {
    console.error("Error updating service:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not update service.",
    });
  }
};

// DELETE SERVICES
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
    console.error("Error deleting service:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not delete service.",
    });
  }
};

// CREATE SLOT
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

    // Parse times safely
    const newSlotStart = new Date(`${value.date}T${value.startTime}:00Z`);
    const newSlotEnd = new Date(`${value.date}T${value.endTime}:00Z`);

    if (newSlotStart >= newSlotEnd) {
      return res.status(400).json({
        success: false,
        msg: "End time must be greater than start time.",
      });
    }

    // Find all existing slots for this service on the same date
    const existingSlots = await prisma.Slot.findMany({
      where: {
        serviceId: value.serviceId,
        date: new Date(value.date),
      },
    });

    // Check for overlapping time intervals (same service only)
    const overlap = existingSlots.some((slot) => {
      const existingStart = new Date(
        `${slot.date.toISOString().split("T")[0]}T${slot.startTime}:00Z`
      );
      const existingEnd = new Date(
        `${slot.date.toISOString().split("T")[0]}T${slot.endTime}:00Z`
      );

      return newSlotStart < existingEnd && newSlotEnd > existingStart;
    });

    if (overlap) {
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
    console.error("Error creating slot:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not create slot.",
    });
  }
};

// GET ALL SLOTS BY SERVICE ID
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
    console.error("Error fetching slots:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch slots.",
    });
  }
};

// DELETE SLOT
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
    console.error("Error deleting slot:", err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not delete slot.",
    });
  }
};

// BOOKING LIST
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

// UPDATE BOOKING STATUS
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

    console.log("Booking details :", bookingDetails);

    // User how booked the service
    const user = await prisma.User.findUnique({
      where: { id: bookingDetails.userId },
    });

    // service which one is booked by user
    const service = await prisma.Service.findUnique({
      where: { id: bookingDetails.serviceId },
    });

    //service booked slot details
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
    console.error("Error updating booking status:", err);
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
};
