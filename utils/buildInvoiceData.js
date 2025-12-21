
/* ---------------- BOOKING INVOICE DATA PREPRA FOR PDF ---------------- */
const buildInvoiceData = (invoiceInfo) => {
  const { business, customer, provider, slot, items, payment, invoiceNumber } =
    invoiceInfo;

  return {
    invoiceNumber: invoiceNumber || `INV-${Date.now()}`,

    business: {
      name: business?.name || "N/A",
      email: business?.email || "N/A",
      phone: business?.phone || "N/A",
    },

    customer: {
      name: customer?.name || "Customer",
      email: customer?.email || "N/A",
      phone: customer?.phone || "N/A",
      address: customer?.address || "N/A",
    },

    provider: {
      name: provider?.name || "N/A",
      serviceName: provider?.serviceName || "N/A",
    },

    slot: {
      date: slot?.date || new Date().toLocaleDateString("en-IN"),
      time: slot?.time || "As scheduled",
      duration: slot?.duration || null,
    },

    items: items || [],

    payment: {
      status: payment?.status || "PAID",
      method: payment?.method || "Stripe",
      transactionId: payment?.transactionId || "N/A",
      tax: payment?.tax || 0,
    },
  };
};

module.exports = { buildInvoiceData };
