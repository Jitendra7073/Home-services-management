const prisma = require("../prismaClient");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { sendMail } = require("../utils/sendmail");
const { generateInvoicePDF } = require("../utils/generateInvoice");
const { buildInvoiceData } = require("../utils/buildInvoiceData");

// Import Email Templates
const {
  bookingSuccessEmailTemplate,
  bookingFailedEmailTemplate,
} = require("../helper/mail-tamplates/tamplates");

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("❌ Missing Stripe signature");
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook Signature Failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log event for monitoring
  console.log(`📥 Webhook received: ${event.type} [${event.id}]`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true, eventId: event.id });
  } catch (err) {
    console.error("❌ Webhook Processing Error:", err);

    // Return 200 to prevent Stripe from retrying (log error for investigation)
    // Change to 500 if you want Stripe to retry
    return res.status(200).json({
      received: true,
      error: "Processing failed, logged for review",
    });
  }
};

// PAYMENT SUCCESS → CREATE BOOKINGS + SEND SUCCESS EMAIL
const handleCheckoutCompleted = async (session) => {
  console.log("✔ Processing checkout completion:", session.id);

  const {
    userId,
    addressId,
    paymentId,
    cartItems: cartItemsStr,
  } = session.metadata || {};

  // Validate metadata
  if (!userId || !addressId || !paymentId || !cartItemsStr) {
    console.error("❌ Missing required metadata:", {
      userId,
      addressId,
      paymentId,
      cartItems: !!cartItemsStr,
    });
    throw new Error("Missing metadata in checkout session");
  }

  let cartItems;
  try {
    cartItems = JSON.parse(cartItemsStr);
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw new Error("Cart items is empty or invalid");
    }
  } catch (err) {
    console.error("❌ Invalid cartItems JSON:", err);
    throw new Error("Invalid cart items format");
  }

  // Check if already processed (idempotency)
  const existingPayment = await prisma.customerPayment.findUnique({
    where: { id: paymentId },
    select: { status: true, stripeSessionId: true },
  });

  if (
    existingPayment?.status === "PAID" &&
    existingPayment?.stripeSessionId === session.id
  ) {
    console.log("⚠️ Payment already processed, skipping:", paymentId);
    return;
  }

  // Fetch user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) {
    console.error("❌ User not found:", userId);
    throw new Error("User not found");
  }

  // Fetch address
  const address = await prisma.address.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    console.error("❌ Address not found:", addressId);
    throw new Error("Address not found");
  }

  // Fetch cart items with lock to prevent race conditions
  const dbCart = await prisma.$transaction(async (tx) => {
    const items = await tx.cart.findMany({
      where: {
        id: { in: cartItems },
        userId,
      },
      include: {
        business: {
          select: {
            id: true,
            businessName: true,
            contactEmail: true,
            phoneNumber: true,
            category: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                addresses: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            mobile: true,
            addresses: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            businessProfile: {
              select: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
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

    if (items.length === 0) {
      throw new Error("Cart items not found");
    }

    return items;
  });

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create bookings
    const createdBookings = await Promise.all(
      dbCart.map((item) =>
        tx.booking.create({
          data: {
            userId,
            addressId,
            businessProfileId: item.business.id,
            serviceId: item.serviceId,
            slotId: item.slotId || null,
            totalAmount: item.service.price,
            paymentStatus: "PAID",
            bookingStatus: "CONFIRMED",
          },
          include: {
            service: true,
            slot: true,
          },
        })
      )
    );

    const bookingIds = createdBookings.map((b) => b.id);

    // Update Payment
    await tx.customerPayment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent,
        bookingIds: JSON.stringify(bookingIds),
      },
    });

    // Clear user cart
    await tx.cart.deleteMany({
      where: {
        id: { in: cartItems },
        userId,
      },
    });

    return { createdBookings, bookingIds };
  });

  console.log("🎉 Bookings confirmed:", result.bookingIds);

  // Build service list for email
  const services = dbCart.map((item) => ({
    name: item.service.name,
    price: item.service.price,
  }));

  // Build invoice data
  const invoiceData = buildInvoiceData({
    business: {
      name: dbCart[0].business.businessName,
      email: dbCart[0].business.contactEmail,
      phone: dbCart[0].business.phoneNumber,
    },
    customer: {
      name: user.name,
      email: user.email,
      phone: dbCart[0].user.mobile || "N/A",
      address: `${address.street}, ${address.city}, ${address.state} - ${address.postalCode}`,
    },
    provider: {
      name: dbCart[0].service.businessProfile.user.name,
      serviceName: dbCart.map((item) => item.service.name).join(", "),
    },
    slot: {
      time: dbCart[0].slot.time,
    },
    items: dbCart.map((item) => ({
      title: item.service.name,
      price: item.service.price,
    })),
    payment: {
      status: "PAID",
      method: "Stripe",
      transactionId: session.payment_intent || session.id,
      tax: 0,
    },
    invoiceNumber: `INV-${
      services[0].name.slice(0, 3) + "-" + userId.slice(0, 3)
    }-${Date.now()}`,
  });

  // Generate PDF (with error handling)
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateInvoicePDF(invoiceData);
    console.log("✅ Invoice PDF generated successfully");
  } catch (pdfError) {
    console.error("❌ PDF generation failed:", pdfError);
    // Continue without PDF - user can download later
  }

  const totalAmount = services.reduce((sum, service) => sum + service.price, 0);

  // Build Email HTML
  const emailHtml = bookingSuccessEmailTemplate({
    userName: user.name || "Customer",
    bookingIds: result.bookingIds,
    totalAmount,
    paymentId,
    paymentDate: new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    customerPortalUrl: `${process.env.CLIENT_URL}/customer/booking`,
    services,
    businessName: dbCart[0].business.businessName,
  });

  // Send Email (non-blocking - don't fail webhook if email fails)
  try {
    const mailOptions = {
      email: user.email,
      subject: "Your Booking Is Confirmed 🎉",
      template: emailHtml,
    };

    // Attach PDF invoice if generated successfully
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `invoice-${result.bookingIds[0].substring(0, 8)}.pdf`,
          content: pdfBuffer,
        },
      ];
    }

    await sendMail(mailOptions);
    console.log("✅ Success email sent to:", user.email);
  } catch (emailError) {
    console.error("❌ Failed to send success email:", emailError);
    // Don't throw - email failure shouldn't fail the webhook
  }
};

// PAYMENT FAILED → SEND FAILURE EMAIL
const handlePaymentFailed = async (paymentIntent) => {
  console.log("⚠ Processing payment failure:", paymentIntent.id);

  const {
    paymentId,
    userId,
    cartItems: cartItemsStr,
  } = paymentIntent.metadata || {};

  if (!paymentId || !userId) {
    console.error("❌ Missing metadata for failed payment");
    return;
  }

  try {
    // Update DB payment status
    await prisma.customerPayment.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
      },
    });

    // Parse cart items
    let cartItems = [];
    try {
      cartItems = JSON.parse(cartItemsStr || "[]");
    } catch (err) {
      console.error("❌ Invalid cartItems JSON in failed payment:", err);
      return;
    }

    if (cartItems.length === 0) {
      console.log("⚠️ No cart items in failed payment");
      return;
    }

    // Fetch user + attempted services
    const [user, dbCart] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.cart.findMany({
        where: { id: { in: cartItems }, userId },
        include: {
          service: {
            select: { name: true, price: true },
          },
          business: {
            select: { businessName: true },
          },
        },
      }),
    ]);

    if (!user) {
      console.error("❌ User not found for failed payment:", userId);
      return;
    }

    if (dbCart.length === 0) {
      console.log("⚠️ No cart items found in DB for failed payment");
      return;
    }

    const services = dbCart.map((item) => ({
      name: item.service.name,
      price: item.service.price,
    }));

    const businessName = dbCart[0].business.businessName;

    // Build failed email
    const emailHtml = bookingFailedEmailTemplate({
      userName: user.name || "Customer",
      services,
      businessName,
      customerPortalUrl: `${process.env.CLIENT_URL}/customer/booking`,
      retryPaymentUrl: `${process.env.CLIENT_URL}/checkout`,
    });

    // Send email (non-blocking)
    await sendMail({
      email: user.email,
      subject: "Payment Failed ❌",
      template: emailHtml,
    });

    console.log("✅ Payment failed email sent to:", user.email);
  } catch (err) {
    console.error("❌ Error handling payment failure:", err);
  }
};

module.exports = { stripeWebhookHandler };
