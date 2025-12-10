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
            contactEmail: true,
            phoneNumber: true,
            websiteURL: true,
            isActive: true,
            socialLinks: true,
            services: {
              select: {
                id: true,
                name: true,
                category: true,
                durationInMinutes: true,
                currency: true,
                price: true,
                averageRating: true,
                reviewCount: true,
                isActive: true,
              },
            },
            slots: {
              select: {
                id: true,
                time: true,
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
    const bookings = await prisma.booking.findMany({
      where: { userId: customerId },

      include: {
        service: {
          select: {
            name: true,
          },
        },
        businessProfile: {
          select: {
            businessName: true,
            user: {
              select: {
                email: true,
                mobile: true,
              },
            },
          },
        },
        slot: {
          select: {
            time: true,
          },
        },
        address: true,
      },

      orderBy: { createdAt: "desc" },
    });

    // Format business fields cleanly
    const formatted = bookings.map((b) => ({
      ...b,
      business: {
        id: b.businessProfile?.id,
        name: b.businessProfile?.businessName,
        email: b.businessProfile?.user?.email,
        phone: b.businessProfile?.user?.mobile,
      },
      businessProfile: undefined, // remove duplicate
    }));

    return res.status(200).json({
      success: true,
      msg: "Bookings fetched successfully.",
      count: formatted.length,
      bookings: formatted,
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
  const { bookingId } = req.body;

  console.log("BookingId", bookingId);

  try {
    const booking = await prisma.Booking.findUnique({
      where: { id: bookingId }, // Fetch related slot + payment
    });

    // Validate booking ownership
    if (!booking || booking.userId !== customerId) {
      return res
        .status(404)
        .json({ success: false, msg: "Booking not found or not yours." });
    }

    // Only allow cancelling pending bookings
    if (booking.bookingStatus !== "PENDING") {
      return res.status(400).json({
        success: false,
        msg: `Cannot cancel a ${booking.bookingStatus.toLowerCase()} booking.`,
      });
    }

    // 1️⃣ Update booking status to CANCELLED
    await prisma.Booking.update({
      where: { id: bookingId },
      data: {
        bookingStatus: "CANCELLED",
        paymentStatus: "CANCELLED",
        updatedAt: new Date(),
      },
    });

    // 2️⃣ Update payment record (if exists)
    if (booking.payment) {
      await prisma.CustomerPayment.update({
        where: { id: booking.payment.id },
        data: {
          status: "CANCELLED",
        },
      });
    }

    return res
      .status(200)
      .json({ success: true, msg: "Booking cancelled successfully." });
  } catch (err) {
    console.error("Cancel Booking Error:", err);

    return res
      .status(500)
      .json({ success: false, msg: "Could not cancel booking." });
  }
};

const getAllServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany();
    return res.status(200).json({
      success: true,
      msg: "Services fetched successfully.",
      count: services.length,
      services,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: "Could not fetch services." });
  }
};

const getCart = async (req, res) => {
  const userId = req.user.id;

  try {
    const cart = await prisma.Cart.findMany({
      where: { userId },
      select: {
        id: true,
        date: true,
        business: {
          select: {
            id: true,
            businessName: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        slot: {
          select: {
            id: true,
            time: true,
          },
        },
      },
    });

    if (cart.length === 0) {
      return res.status(200).json({
        success: true,
        msg: "Cart is empty.",
        totalItems: 0,
        totalPrice: 0,
      });
    }

    const totalItems = cart.length;
    const totalPrice = cart.reduce((sum, item) => sum + item.service.price, 0);

    return res.status(200).json({
      success: true,
      msg: "Cart fetched successfully.",
      totalItems,
      totalPrice,
      cart,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, msg: "Could not fetch cart." });
  }
};

const addToCart = async (req, res) => {
  const userId = req.user.id;
  const { serviceId, businessId, slotId, date } = req.body;

  try {
    // ==== Check if business exists ====
    const business = await prisma.BusinessProfile.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      return res.status(404).json({
        success: false,
        msg: "Business does not exist.",
      });
    }

    // ==== Check if service exists ====
    const service = await prisma.Service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      return res.status(404).json({
        success: false,
        msg: "Service not found.",
      });
    }

    // ==== Check if slot exists ====
    const slot = await prisma.Slot.findUnique({ where: { id: slotId } });
    if (!slot) {
      return res.status(404).json({
        success: false,
        msg: "Slot does not exist.",
      });
    }

    const isoDate = new Date(date).toISOString();

    // ==== Prevent duplicate cart entries ====
    const existing = await prisma.Cart.findFirst({
      where: {
        userId,
        serviceId,
        slotId,
        date: isoDate,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        msg: "This service & slot is already in your cart.",
      });
    }

    // ==== Add to cart ====
    const added = await prisma.Cart.create({
      data: {
        userId,
        serviceId,
        businessId,
        slotId,
        date: isoDate,
      },
    });

    return res.status(201).json({
      success: true,
      msg: "Service added to cart successfully.",
      cart: added,
    });
  } catch (err) {
    console.error("ADD TO CART ERROR:", err);
    return res.status(500).json({
      success: false,
      msg: "Internal server error while adding to cart.",
    });
  }
};

const removeItemFromCart = async (req, res) => {
  try {
    const { cartId } = req.body;

    if (!cartId) {
      return res.status(400).json({
        success: false,
        msg: "cartId is required.",
      });
    }

    const cartItem = await prisma.Cart.findUnique({
      where: { id: cartId },
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        msg: "Item not found in cart.",
      });
    }

    await prisma.Cart.delete({
      where: { id: cartId },
    });

    return res.status(200).json({
      success: true,
      msg: "Item removed from your cart.",
    });
  } catch (error) {
    console.error("Remove cart error:", error);
    return res.status(500).json({
      success: false,
      msg: "Server Error: Could not remove item from cart",
    });
  }
};

module.exports = {
  getAllProviders,
  getProviderById,
  bookSlot,
  getCustomerBookings,
  cancelBooking,
  getAllServices,
  getCart,
  addToCart,
  removeItemFromCart,
};
