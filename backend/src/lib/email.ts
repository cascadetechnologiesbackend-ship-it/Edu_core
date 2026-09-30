import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.log("[EMAIL DEV]", { to: options.to, subject: options.subject });
    console.log("[EMAIL BODY]", options.text);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "noreply@schoolmitra.in",
    ...options,
  });
}
