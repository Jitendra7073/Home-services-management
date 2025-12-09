const prisma = require("../prismaClient");
const Stripe = require("stripe");

const customerPayment = async (req, res) => {
  const userId = req.user.id;
  let createdBookings = [];
  let paymentEntry = null;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { cartItems, addressId } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ msg: "No cart items selected." });
    }

    if (!addressId) {
      return res.status(400).json({ msg: "Address is required." });
    }

    // Fetch address validation
    const userAddress = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!userAddress) {
      return res.status(400).json({ msg: "Invalid address selected." });
    }

    // Fetch cart + services
    const dbCart = await prisma.cart.findMany({
      where: {
        id: { in: cartItems },
        userId,
      },
      include: {
        service: true,
        business: true, // must exist in schema
      },
    });

    if (dbCart.length === 0) {
      return res.status(400).json({ msg: "No valid items found in cart." });
    }

    if (dbCart.length !== cartItems.length) {
      return res.status(400).json({
        msg: "Some cart items do not belong to the user.",
      });
    }

    // Business validation
    const businessIds = dbCart.map((c) => c.business.id);
    const uniqueBusinesses = [...new Set(businessIds)];

    if (uniqueBusinesses.length > 1) {
      return res.status(400).json({
        msg: "You can only book services from the same business.",
      });
    }

    // Total amount
    const totalAmount = dbCart.reduce(
      (sum, item) => sum + item.service.price,
      0
    );

    // Create ONE BOOKING PER SERVICE
    createdBookings = await Promise.all(
      dbCart.map((item) =>
        prisma.booking.create({
          data: {
            userId,
            addressId,
            businessProfileId: item.business.id,
            serviceId: item.serviceId,
            slotId: item.slotId || null,
            totalAmount: item.service.price,
            paymentStatus: "PENDING",
            bookingStatus: "PENDING",
          },
        })
      )
    );

    // Create single payment entry for ALL bookings
    paymentEntry = await prisma.customerPayment.create({
      data: {
        userId,
        addressId,
        amount: totalAmount,
        status: "PENDING",
        bookingIds: JSON.stringify(createdBookings.map((b) => b.id)),
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      metadata: {
        paymentId: paymentEntry.id,
        bookingIds: JSON.stringify(createdBookings.map((b) => b.id)),
        userId,
      },

      line_items: dbCart.map((item) => ({
        price_data: {
          currency: "inr",
          product_data: { name: item.service.name },
          unit_amount: item.service.price * 100,
        },
        quantity: 1,
      })),

      success_url: `${process.env.FRONTEND_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.FRONTEND_CANCEL_URL,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Payment Error:", error);

    // Cleanup if something fails
    try {
      for (const b of createdBookings) {
        await prisma.booking.delete({ where: { id: b.id } });
      }
      if (paymentEntry?.id) {
        await prisma.customerPayment.delete({
          where: { id: paymentEntry.id },
        });
      }
    } catch (cleanupErr) {
      console.error("Cleanup Error:", cleanupErr);
    }

    return res.status(500).json({ msg: "Payment initialization failed." });
  }
};

module.exports = { customerPayment };
