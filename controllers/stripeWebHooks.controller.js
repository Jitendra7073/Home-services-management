const prisma = require("../prismaClient");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];

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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook Processing Error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// =====================================================
// CHECKOUT SUCCESS
// =====================================================
const handleCheckoutCompleted = async (session) => {
  console.log("✔ Checkout Completed Webhook");

  const paymentId = session.metadata.paymentId;
  const bookingIds = JSON.parse(session.metadata.bookingIds);
  const userId = session.metadata.userId;

  if (!paymentId || !bookingIds?.length) {
    console.error("❌ Missing metadata");
    return;
  }

  // Update payment entry
  await prisma.customerPayment.update({
    where: { id: paymentId },
    data: {
      status: "PAID",
      stripeSessionId: session.id,
      paymentIntentId: session.payment_intent,
    },
  });

  // Update ALL bookings
  await prisma.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: {
      paymentStatus: "PAID",
      bookingStatus: "CONFIRMED",
    },
  });

  // Clear user's entire cart
  await prisma.cart.deleteMany({
    where: { userId },
  });

  console.log("🎉 Payment success → Bookings confirmed:", bookingIds);
};

// =====================================================
// PAYMENT FAILED
// =====================================================
const handlePaymentFailed = async (paymentIntent) => {
  console.log("⚠ Payment Failed");

  const paymentId = paymentIntent.metadata?.paymentId;
  const bookingIds = JSON.parse(paymentIntent.metadata?.bookingIds || "[]");

  if (!paymentId || bookingIds.length === 0) return;

  await prisma.customerPayment.update({
    where: { id: paymentId },
    data: { status: "FAILED" },
  });

  await prisma.booking.updateMany({
    where: { id: { in: bookingIds } },
    data: {
      paymentStatus: "FAILED",
      bookingStatus: "CANCELLED",
    },
  });

  console.log("❌ Payment failed → bookings cancelled");
};

module.exports = { stripeWebhookHandler };
