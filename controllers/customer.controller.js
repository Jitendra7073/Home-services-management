const prisma = require("../prismaClient");
const {
  slotBookingRequestTemplate,
} = require("../helper/mail-tamplates/tamplates");
const { sendMail } = require("../utils/sendmail");

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
      return res
        .status(200)
        .json({ success: true, msg: "No providers found.", providers: [] });
    }

    return res.status(200).json({
      success: true,
      msg: "Providers fetched successfully.",
      count: providers.length,
      providers,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not fetch providers.",
    });
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
      return res
        .status(404)
        .json({ success: false, msg: "Provider not found." });
    }

    return res.status(200).json({
      success: true,
      msg: "Provider fetched successfully.",
      provider,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: "Server Error: Could not fetch provider." });
  }
};

// BOOK SLOT (with row locking)
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
    const result = await prisma.$transaction(async (tx) => {
      const slotRows = await tx.$queryRaw`
        SELECT *
        FROM "Slot"
        WHERE id = ${slotId} AND "serviceId" = ${serviceId}
        FOR UPDATE
      `;

      if (slotRows.length === 0) {
        return {
          success: false,
          msg: "Slot not found for the selected service.",
        };
      }

      const slot = slotRows[0];

      if (slot.isBooked) {
        return { success: false, msg: "This slot is already booked." };
      }

      const newBooking = await tx.Booking.create({
        data: {
          userId: customerId,
          serviceId: serviceId,
          slotId: slotId,
          businessProfileId: slot.businessProfileId,
        },
      });

      await tx.Slot.update({
        where: { id: slotId },
        data: { isBooked: true, bookedById: customerId },
      });

      return {
        success: true,
        msg: "Slot booked successfully.",
        newBooking,
      };
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const user = await prisma.user.findUnique({ where: { id: customerId } });

    await sendMail({
      email: user.email,
      subject: "Slot Booking Confirmation",
      template: slotBookingRequestTemplate(
        user.name,
        result.newBooking.serviceId,
        result.newBooking.date,
        result.newBooking.startTime,
        result.newBooking.endTime
      ),
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
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
            service: true,
            businessProfile: {
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
                },
              },
            },
          },
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
    return res
      .status(500)
      .json({ success: false, msg: "Could not fetch bookings." });
  }
};

// CANCEL BOOKING
const cancelBooking = async (req, res) => {
  const customerId = req.user.id;
  const { bookingId } = req.params;

  try {
    const booking = await prisma.Booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.userId !== customerId) {
      return res
        .status(404)
        .json({ success: false, msg: "Booking not found or not yours." });
    }

    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        msg: `Cannot cancel a ${booking.status.toLowerCase()} booking.`,
      });
    }

    await prisma.booking.delete({
      where: { id: bookingId },
    });
    await prisma.Slot.update({
      where: { id: booking.slotId },
      data: { isBooked: false, bookedById: null },
    });

    return res
      .status(200)
      .json({ success: true, msg: "Booking cancelled successfully." });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: "Could not cancel booking." });
  }
};

module.exports = {
  getAllProviders,
  getProviderById,
  bookSlot,
  getCustomerBookings,
  cancelBooking,
};
