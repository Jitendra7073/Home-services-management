const welcomeUserTamplate = (name) => {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; background:#f7f7f7; padding:20px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" width="600" align="center" style="background:#ffffff; border-radius:8px; padding:30px;">
        <tr>
          <td>
            <h2 style="color:#333; margin-bottom:10px;">Welcome, ${name} 👋</h2>
            <p style="font-size:16px; color:#555;">
              Thank you for registering with <strong>Home Service Management</strong>.  
              We're excited to have you on board!
            </p>

            <p style="margin-top:30px; font-size:14px; color:#777;">
              Best Regards,<br/>
              <strong>Home Service Management Team</strong>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
};

const forgotPasswordTamplate = (name, token) => {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; background:#f7f7f7; padding:20px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" width="600" align="center" style="background:#ffffff; border-radius:8px; padding:30px;">
        <tr>
          <td>
            <h2 style="color:#333;">Hello ${name},</h2>

            <p style="font-size:16px; color:#555;">
              You requested to reset your password.  
              Click the button below to proceed:
            </p>

            <a href="http://localhost:5000/auth/reset-password/${token}"
              style="display:inline-block; margin:20px 0; background:#007bff; color:#fff; padding:12px 20px; text-decoration:none; border-radius:5px;">
              Reset Password
            </a>

            <p style="font-size:14px; color:#777;">
              If you did not request this, please ignore this email.
            </p>

            <p style="margin-top:30px; font-size:14px; color:#777;">
              Best Regards,<br/>
              <strong>Home Service Management Team</strong>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
};

const slotBookingRequestTemplate = (name, service, date, startTime, endTime) => {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; background:#f7f7f7; padding:20px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" width="600" align="center" style="background:#ffffff; border-radius:8px; padding:30px;">
        <tr>
          <td>
            <h2 style="color:#333;">Dear ${name},</h2>

            <p style="font-size:16px; color:#555;">
              Your booking request for the service 
              <strong>${service}</strong> has been submitted.
            </p>

            <p style="font-size:15px; color:#444;">
              We have notified the provider. You will receive another update once they confirm.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
              <tr><td style="padding:5px 0;"><strong>Date:</strong> ${date}</td></tr>
              <tr><td style="padding:5px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</td></tr>
            </table>

            <p style="margin-top:30px; font-size:14px; color:#777;">
              Best Regards,<br/>
              <strong>Home Service Management Team</strong>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
};

const slotBookingStatusTemplate = (name, service, date, startTime, endTime, status) => {

  // Status-specific messages
  const statusMessages = {
    Confirmed: {
      title: "Booking Confirmed 🎉",
      message: "Great news! Your booking has been confirmed by the provider.",
      color: "#4CAF50"
    },
    Inprogress: {
      title: "Service In Progress",
      message: "Your service provider has started working on your booking.",
      color: "#2196F3"
    },
    OnHold: {
      title: "Booking On Hold",
      message: "Your booking is currently on hold. We will notify you when it resumes.",
      color: "#FFC107"
    },
    Completed: {
      title: "Service Completed ✔",
      message: "Your service has been successfully completed. Thank you for choosing us!",
      color: "#4CAF50"
    },
    Cancelled: {
      title: "Booking Cancelled",
      message: "Your booking has been cancelled. If this was a mistake, please contact support.",
      color: "#F44336"
    },
    Rejected: {
      title: "Booking Rejected",
      message: "Unfortunately, your booking request was rejected by the provider.",
      color: "#E53935"
    },
    Failed: {
      title: "Service Failed",
      message: "We encountered an issue while processing your service. Please reach out to support.",
      color: "#D32F2F"
    },
    Refunded: {
      title: "Refund Processed 💰",
      message: "Your payment has been refunded successfully. It may take 3–5 days to reflect.",
      color: "#009688"
    },
    Closed: {
      title: "Booking Closed",
      message: "This booking has been closed. Thank you for using our platform.",
      color: "#616161"
    },
  };

  // fallback if status text is not matched
  const s = statusMessages[status] || "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif; background:#f7f7f7; padding:20px;">
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" width="600" align="center" style="background:#ffffff; border-radius:8px; padding:30px;">
        <tr>
          <td>

            <!-- Title -->
            <h2 style="color:${s.color}; margin-bottom:10px;">${s.title}</h2>

            <!-- Greeting -->
            <p style="font-size:16px; color:#333;">Hello ${name},</p>

            <!-- Status Message -->
            <p style="font-size:15px; color:#555; line-height:1.6;">
              ${s.message}
            </p>

            <!-- Booking Details -->
            <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
              <tr><td style="padding:5px 0;"><strong>Service:</strong> ${service}</td></tr>
              <tr><td style="padding:5px 0;"><strong>Date:</strong> ${date}</td></tr>
              <tr><td style="padding:5px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</td></tr>
              <tr><td style="padding:5px 0;"><strong>Status:</strong> <span style="color:${s.color}; font-weight:bold;">${status}</span></td></tr>
            </table>

            <!-- Footer -->
            <p style="margin-top:30px; font-size:14px; color:#777;">
              Best Regards,<br/>
              <strong>Home Service Management Team</strong>
            </p>

          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
};

module.exports = {
    welcomeUserTamplate,
    forgotPasswordTamplate,
    slotBookingRequestTemplate,
    slotBookingStatusTemplate
}