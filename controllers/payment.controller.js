const prisma = require("../prismaClient");
const Stripe = require("stripe");

const customerPayment = async (req, res) => {
  const userId = req.user.id;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const { cartItems, addressId } = req.body;

    if (!cartItems || cartItems.length === 0)
      return res.status(400).json({ msg: "Cart is empty" });

    if (!addressId) return res.status(400).json({ msg: "Address required" });

    // fetch cart + services
    const dbCart = await prisma.cart.findMany({
      where: { id: { in: cartItems }, userId },
      include: { service: true, business: true },
    });

    // business validation: only single business allowed
    const businessIds = [...new Set(dbCart.map((c) => c.business.id))];
    if (businessIds.length > 1)
      return res
        .status(400)
        .json({ msg: "Only same-business services allowed" });

    const totalAmount = dbCart.reduce((s, c) => s + c.service.price, 0);

    // Create temporary payment entry
    const paymentRecord = await prisma.customerPayment.create({
      data: {
        userId,
        addressId,
        amount: totalAmount,
        status: "PENDING",
        bookingIds: JSON.stringify([]), // here is the error
      },
    });

    // create stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      metadata: {
        userId,
        addressId,
        paymentId: paymentRecord.id,
        cartItems: JSON.stringify(cartItems),
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
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Payment failed" });
  }
};

module.exports = {
  customerPayment,
};
