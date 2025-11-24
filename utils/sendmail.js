const nodemailer = require("nodemailer");

const sendMail = async ({ email, subject, template }) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.SENDER_EMAIL,
            pass: process.env.SENDER_EMAIL_PASSWORD,
        },
    });

    const info = await transporter.sendMail({
        from: `"Home Service Management" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: subject,
        html: template,
    });

    console.log(`Email send successfully to ${email}`);
}

module.exports ={
    sendMail
}