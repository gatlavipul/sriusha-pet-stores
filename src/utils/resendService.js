/**
 * Sri Usha Vet & Pet Stores — Resend Transactional Email Service
 * Edge-compatible transactional email delivery using native fetch.
 * Runs seamlessly on Cloudflare Workers and Node.js.
 */
import logger from "./logger.js";

export function isResendConfigured() {
  const key = process.env.RESEND_API_KEY;
  return Boolean(
    key &&
    typeof key === "string" &&
    key.trim().length > 5 &&
    key !== "your_resend_api_key" &&
    !key.includes("placeholder")
  );
}

/**
 * Sends a transactional email via the Resend REST API
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!to || !subject || (!html && !text)) {
    return {
      success: false,
      error: "Missing required email fields (to, subject, html/text)",
      mode: "validation_failed",
    };
  }

  const recipient = Array.isArray(to) ? to : [to];

  if (!isResendConfigured()) {
    logger.info("resend_safe_mode", `[Safe Mode] Resend API key not configured. Logged email to ${recipient.join(", ")}: "${subject}"`, {
      recipient,
      subject,
      provider: "resend",
    });
    return {
      success: true,
      mode: "safe_logged",
      message: "Resend credentials unconfigured; email recorded to notification audit log.",
    };
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "Sri Usha Vet & Pet Stores <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipient,
        subject,
        html: html || `<p>${text}</p>`,
        text: text || html?.replace(/<[^>]*>/g, ""),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("resend_send_failed", `Resend API returned status ${response.status}`, data);
      return {
        success: false,
        error: data.message || `Resend HTTP ${response.status}`,
        mode: "api_error",
      };
    }

    logger.info("resend_email_dispatched", `Email dispatched via Resend: ID ${data.id} to ${recipient.join(", ")}`, {
      id: data.id,
      recipient,
      subject,
    });

    return {
      success: true,
      id: data.id,
      mode: "sent",
    };
  } catch (error) {
    logger.error("resend_exception", "Unexpected error dispatching email via Resend", error);
    return {
      success: false,
      error: error.message,
      mode: "exception",
    };
  }
}

/**
 * Pre-formatted templates for transactional events
 */
export async function sendWelcomeEmail({ to, name }) {
  const customerName = name || "Valued Pet Parent";
  const subject = "Welcome to Sri Usha Vet & Pet Stores! 🐾";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <h2 style="color: #059669;">Welcome to Sri Usha Vet & Pet Stores!</h2>
      <p>Hi <strong>${customerName}</strong>,</p>
      <p>Thank you for creating an account with us. We are proud to serve Hyderabad and beyond with top-quality veterinary medicines, premium pet foods, and pet care essentials.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin: 0 0 8px 0; color: #334155;">What you can do with your account:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #475569;">
          <li>Track live delivery status of your pet supplies</li>
          <li>Save multiple delivery addresses for fast checkout</li>
          <li>Access tax invoices and historical orders anytime</li>
        </ul>
      </div>
      <p style="margin-top: 24px;">Warm regards,<br><strong>Sri Usha Vet & Pet Stores Team</strong><br>Uppal, Hyderabad</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

export default {
  isResendConfigured,
  sendEmail,
  sendWelcomeEmail,
};

