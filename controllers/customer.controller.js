const prisma = require("../prismaClient");
const { slotBookingTemplate } = require("../helper/mail-tamplates/tamplates");
const { sendMail } = require("../utils/sendMail");

// USER PROFILE
const getUserProfile = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true,
        addresses: true, // include all addresses
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found." });
    }

    return res.status(200).json({
      success: true,
      msg: "User profile fetched successfully.",
      user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, msg: "Server Error: Could not fetch user profile." });
  }
};

// PROVIDER LIST
const getAllProviders = async (req, res) => {
  try {
    const providers = await prisma.user.findMany({
      where: { role: "provider" },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        businessProfile: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            isActive: true,
            services: {
              select: {
                id: true,
                name: true,
                category: true,
                durationInMinutes: true,
                price: true,
                isActive: true,
                slots: {
                  select: {
                    id: true,
                    date: true,
                    startTime: true,
                    endTime: true,
                    isBooked: true,
                  },
                  // where: { isBooked: false }, 
                },
              },
            },
          },
        },
        addresses: true,
      },
    });

    if (!providers || providers.length === 0) {
      return res.status(200).json({ success: true, msg: "No providers found.", providers: [] });
    }

    return res.status(200).json({
      success: true,
      msg: "Providers fetched successfully.",
      count: providers.length,
      providers,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, msg: "Server Error: Could not fetch providers." });
  }
};

// PROVIDER BY ID
const getProviderById = async (req, res) => {
  const { providerId } = req.params;

  try {
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        businessProfile: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            services: {
              select: {
                id: true,
                name: true,
                category: true,
                durationInMinutes: true,
                price: true,
                slots: {
                  select: {
                    id: true,
                    date: true,
                    startTime: true,
                    endTime: true,
                    isBooked: true,
                  },
                  where: { isBooked: false },
                },
              },
            },
          },
        },
        addresses: true,
      },
    });

    if (!provider) {
      return res.status(404).json({ success: false, msg: "Provider not found." });
    }

    return res.status(200).json({
      success: true,
      msg: "Provider fetched successfully.",
      provider,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, msg: "Server Error: Could not fetch provider." });
  }
};

// BOOK SLOT
const bookSlot = async (req, res) => {

  const customerId = req.user.id;
  const { serviceId, slotId } = req.body;

  if (!serviceId || !slotId) {
    return res.status(400).json({
      success: false,
      msg: "Both serviceId and slotId are required.",
    });
  }

  try {

    const slot = await prisma.slot.findFirst({
      where: {
        id: slotId,
        serviceId: serviceId,
      },
      include: {
        service: true,
        businessProfile: true,
      },
    });

    if (!slot) {
      return res.status(400).json({
        success: false,
        msg: "Slot not found for the selected service.",
      });
    }

    if (slot.isBooked) {
      return res.status(400).json({
        success: false,
        msg: "This slot is already booked.",
      });
    }

    // Create the booking
    const newBooking = await prisma.booking.create({
      data: {
        userId: customerId,
        serviceId: serviceId,
        slotId: slot.id,
        businessProfileId: slot.businessProfileId,
        status: "Pending", // initial status
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: customerId },
    });

    // Mark the slot as booked
    await prisma.slot.update({
      where: { id: slotId },
      data: { isBooked: true },
    });

     await sendMail({
      email: user.email,
      subject: "Slot Booking Confirmation",
      template: slotBookingTemplate(user.name, slot.service.name, slot.date, slot.startTime, slot.endTime)
    });

    return res.status(201).json({
      success: true,
      msg: "Slot booked successfully.",
      newBooking,
    });

  } catch (err) {
    console.error("Booking Error:", err);
    return res.status(400).json({
      success: false,
      msg: err.message || "Could not book slot.",
    });
  }
};

// CUSTOMER BOOKINGS
const getCustomerBookings = async (req, res) => {
  const customerId = req.user.id;

  try {
    const bookings = await prisma.Booking.findMany({
      where: { userId: customerId },
      include: {
        slot: {
          include: {
            service: true, businessProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    mobile: true,
                    role: true,
                    createdAt: true,
                  },
                }
              }
            }
          }
        },
        service: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      msg: "Bookings fetched successfully.",
      count: bookings.length,
      bookings,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, msg: "Could not fetch bookings." });
  }
};

// CANCEL BOOKING
const cancelBooking = async (req, res) => {
  const customerId = req.user.id;
  const { bookingId } = req.params;

  try {
    const booking = await prisma.Booking.findUnique({ where: { id: bookingId } });

    if (!booking || booking.userId !== customerId) {
      return res.status(404).json({ success: false, msg: "Booking not found or not yours." });
    }

    if (booking.status !== "Pending") {
      return res.status(400).json({ success: false, msg: `Cannot cancel a ${booking.status.toLowerCase()} booking.` });
    }

    await prisma.booking.update({ where: { id: bookingId }, data: { status: "Cancelled" } });
    await prisma.slot.update({ where: { id: booking.slotId }, data: { isBooked: false } });

    return res.status(200).json({ success: true, msg: "Booking cancelled successfully." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, msg: "Could not cancel booking." });
  }
};

module.exports = {
  getUserProfile,
  getAllProviders,
  getProviderById,
  bookSlot,
  getCustomerBookings,
  cancelBooking,
};
