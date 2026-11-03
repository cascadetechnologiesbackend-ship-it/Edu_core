import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  unconfigured?: boolean;
  messageId?: string | undefined;
  attempts?: number;
  error?: string | undefined;
}

/**
 * Checks whether SMTP credentials are fully configured in the environment.
 * Replaces the legacy fallback to "smtp.example.com" with honest validation.
 */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

/**
 * Sends an email using configured SMTP transport or fails closed with honest status.
 *
 * Requirements (S25-F06 / AC7):
 * 1. Never defaults to "smtp.example.com".
 * 2. In production without SMTP configured: returns { delivered: false, unconfigured: true }.
 * 3. In development without SMTP configured: logs dev mock and returns { delivered: true, messageId: "dev-mock-..." }.
 * 4. In configured environments: dispatches via nodemailer and returns { delivered: true, messageId: info.messageId, attempts: 1 }.
 * 5. On send error: returns { delivered: false, error: errMsg, attempts: 1 }.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailDeliveryResult> {
  const configured = isEmailConfigured();

  if (!configured) {
    if (process.env.NODE_ENV === "development") {
      console.log("[EMAIL DEV MOCK]", { to: options.to, subject: options.subject });
      console.log("[EMAIL BODY]", options.text);
      return {
        delivered: true,
        messageId: `dev-mock-email-${Date.now()}`,
        attempts: 1,
      };
    }

    console.warn(`[EMAIL UNCONFIGURED] Would have sent: "${options.subject}" to ${options.to}`);
    return {
      delivered: false,
      unconfigured: true,
      error: "SMTP credentials not configured in environment.",
    };
  }

  try {
    const transporter = getTransporter();
    if (!transporter) {
      return {
        delivered: false,
        unconfigured: true,
        error: "SMTP transporter unavailable.",
      };
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@schoolmitra.in",
      ...options,
    });

    console.info(`[EMAIL SENT] ID: ${info.messageId} to: ${options.to}`);
    return {
      delivered: true,
      messageId: info.messageId,
      attempts: 1,
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL ERROR] Failed to send email to ${options.to}:`, errMsg);
    return {
      delivered: false,
      attempts: 1,
      error: errMsg,
    };
  }
}
