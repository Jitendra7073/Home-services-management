const prisma = require("../prismaClient");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const { sendMail } = require("../utils/sendmail");
const { generateInvoicePDF } = require("../utils/generateInvoice");
const { buildInvoiceData } = require("../utils/buildInvoiceData");
const {
  bookingSuccessEmailTemplate,
  bookingFailedEmailTemplate,
} = require("../helper/mail-tamplates/tamplates");

const NotificationService = require("../service/notification-service");
const { StoreNotification } = require("./notification.controller");

/* --------------------------------------- STRIPE WEBHOOK HANDLER --------------------------------------- */

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log("🔥 Stripe Event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (session.mode === "subscription") {
        await handleProviderSubscriptionCompleted(session);
      } else {
        await handleCheckoutCompleted(session);
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleProviderSubscriptionUpdated(event.data.object);
    }

    if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    return res.status(200).json({ received: true });
  }
};

/* --------------------------------------- CUSTOMER PAYMENT SUCCESS --------------------------------------- */

const handleCheckoutCompleted = async (session) => {
  const { userId, addressId, paymentId, cartItems } = session.metadata || {};
  if (!userId || !addressId || !paymentId || !cartItems) return;

  const cartIds = JSON.parse(cartItems);

  const payment = await prisma.customerPayment.findUnique({
    where: { id: paymentId },
  });

  if (payment?.status === "PAID") return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const address = await prisma.address.findUnique({ where: { id: addressId } });

  const cart = await prisma.cart.findMany({
    where: { id: { in: cartIds }, userId },
    include: {
      service: {
        include: {
          businessProfile: {
            include: { user: true },
          },
        },
      },
      slot: true,
      business: true,
    },
  });

  if (!cart.length) return;

  const result = await prisma.$transaction(async (tx) => {
    const bookings = await Promise.all(
      cart.map((item) =>
        tx.booking.create({
          data: {
            userId,
            addressId,
            businessProfileId: item.business.id,
            serviceId: item.serviceId,
            slotId: item.slotId,
            totalAmount: item.service.price,
            paymentStatus: "PAID",
            bookingStatus: "CONFIRMED",
            date: item.date,
          },
        })
      )
    );

    await tx.customerPayment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent,
        bookingIds: JSON.stringify(bookings.map((b) => b.id)),
      },
    });

    await tx.cart.deleteMany({
      where: { id: { in: cartIds }, userId },
    });

    return bookings;
  });

  try {
    const provider = await prisma.businessProfile.findUnique({
      where: { id: result[0].businessProfileId },
      select: { userId: true },
    });

    const fcmTokens = await prisma.fCMToken.findMany({
      where: { userId: provider.userId },
    });

    const services = await prisma.service.findMany({
      where: { id: { in: result.map((r) => r.serviceId) } },
    });

    const payload = {
      title: "New Booking Received",
      body: `New booking for ${services.map((s) => s.name).join(", ")} by ${user.name}`,
      type: "BOOKING_CREATED",
    };

    await NotificationService.sendNotification(
      fcmTokens,
      payload.title,
      payload.body,
      { type: payload.type }
    );

    await StoreNotification(payload, provider, user);
  } catch (err) {
    console.error("❌ Notification error:", err);
  }
};

/* --------------------------------------- PROVIDER SUBSCRIPTION SUCCESS --------------------------------------- */

const handleProviderSubscriptionCompleted = async (session) => {

  const { userId, subscriptionType } = session.metadata || {};
  if (!userId || subscriptionType !== "PROVIDER") {
    console.warn("⚠️ Invalid subscription metadata");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription
  );

  const priceItem = subscription.items?.data?.[0];
  if (!priceItem?.price?.id) {
    console.error("❌ Price ID not found in subscription");
    return;
  }

  const plan = await prisma.providerSubscriptionPlan.findFirst({
    where: {
      stripePriceId: priceItem.price.id,
    },
  });

  if (!plan) {
    console.error("❌ Plan not found for price:", priceItem.price.id);
    return;
  }

  /* ================= SAFE DATE HANDLING ================= */

  const periodStartUnix =
    subscription.current_period_start ?? subscription.created;

  const periodEndUnix =
    subscription.current_period_end ??
    subscription.created +
    (priceItem.price.recurring?.interval === "year"
      ? 365 * 24 * 60 * 60
      : 30 * 24 * 60 * 60);

  const currentPeriodStart = new Date(periodStartUnix * 1000);
  const currentPeriodEnd = new Date(periodEndUnix * 1000);

  if (isNaN(currentPeriodStart) || isNaN(currentPeriodEnd)) {
    console.error("❌ Invalid subscription dates", {
      currentPeriodStart,
      currentPeriodEnd,
    });
    return;
  }

  /* ================= UPSERT ================= */

  await prisma.providerSubscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
    },
    update: {
      planId: plan.id,
      status: subscription.status,
      currentPeriodEnd,
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: true,
      subscriptionType: plan.id
    }
  })


  console.log("✅ Provider subscription stored successfully:", userId);
};


/* --------------------------------------- PROVIDER SUBSCRIPTION UPDATE / CANCEL --------------------------------------- */

const handleProviderSubscriptionUpdated = async (subscription) => {
  console.log("🔄 Subscription update:", subscription.id, subscription.status);

  await prisma.providerSubscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
};

/* --------------------------------------- CUSTOMER PAYMENT FAILED --------------------------------------- */

const handlePaymentFailed = async (intent) => {
  const { userId, paymentId } = intent.metadata || {};
  if (!userId || !paymentId) return;

  await prisma.customerPayment.update({
    where: { id: paymentId },
    data: { status: "FAILED" },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await sendMail({
    email: user.email,
    subject: "Payment Failed",
    template: bookingFailedEmailTemplate({
      userName: user.name,
    }),
  });
};

module.exports = { stripeWebhookHandler };
