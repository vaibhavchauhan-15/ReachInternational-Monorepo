import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Result of a tracked email send — includes the provider message id,
 * the raw provider response, and retry metadata so the notification
 * log can record a complete audit trail.
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerResponse?: Record<string, unknown>;
  error?: string;
  attempts: number;
}

/**
 * Low-level boolean wrapper kept for backward compatibility with
 * existing callers (welcome/approval/reset emails). New notification
 * flows should prefer `sendEmailWithTracking` to capture the SendGrid
 * message id and provider response.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const result = await sendEmailWithTracking(options, { maxRetries: 0 });
  return result.success;
}

// Default retry configuration for transactional + summary emails.
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1500;

interface RetryConfig {
  maxRetries?: number;
  retryDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send an email via SendGrid with delivery verification and retry support.
 *
 * SendGrid's `send()` resolves to an array of response objects (one per
 * recipient). A 202 status means the provider accepted the message — we
 * treat that as success and capture the `X-Message-Id` header for
 * downstream delivery tracking in the notifications table.
 *
 * On failure the function retries up to `maxRetries` times with a fixed
 * delay, then returns the final error so the caller can log it.
 */
export async function sendEmailWithTracking(
  options: EmailOptions,
  retryConfig: RetryConfig = {}
): Promise<EmailSendResult> {
  const maxRetries = retryConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = retryConfig.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || "REACH INTERNATIONAL";

  if (!fromEmail) {
    return {
      success: false,
      error: "SENDGRID_FROM_EMAIL is not configured",
      attempts: 0,
    };
  }

  let lastError = "Unknown error";
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const [response] = await sgMail.send({
        from: { email: fromEmail, name: fromName },
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject,
      });

      const statusCode = response?.statusCode ?? 0;
      const accepted = statusCode >= 200 && statusCode < 300;

      // SendGrid returns the message id in the X-Message-Id header.
      const messageId =
        (response?.headers?.["x-message-id"] as string | undefined) ??
        (response?.headers?.["X-Message-Id"] as string | undefined) ??
        undefined;

      const providerResponse: Record<string, unknown> = {
        statusCode,
        body: response?.body ?? null,
        headers: response?.headers ?? null,
      };

      if (accepted) {
        console.log(
          `[EMAIL] Accepted by SendGrid — to: ${options.to}, subject: ${options.subject}, messageId: ${messageId ?? "n/a"}, status: ${statusCode}`
        );
        return {
          success: true,
          messageId,
          providerResponse,
          attempts,
        };
      }

      lastError = `SendGrid returned status ${statusCode}`;
      console.error(`[EMAIL] Non-2xx from SendGrid (${statusCode}) for ${options.to}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.error(`[EMAIL] Attempt ${attempts} failed for ${options.to}:`, error);
    }

    if (attempt < maxRetries) {
      await sleep(retryDelayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
  };
}

export async function sendWelcomeEmail(email: string, name: string, password: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to REACH INTERNATIONAL</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .credentials { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Welcome to REACH INTERNATIONAL</h1>
      </div>
      <div class="content">
        <h2>Hello ${name},</h2>
        <p>Your account has been created successfully. Here are your login credentials:</p>
        <div class="credentials">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        <p>Please login at the link below:</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="btn">Login to Dashboard</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">For security, please change your password after first login.</p>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL Service Management System.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Welcome to REACH INTERNATIONAL - Your Account Credentials",
    html,
  });
}

export async function sendApprovalEmail(email: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Approved</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: linear-gradient(135deg, #16a34a, #059669); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Account Approved</h1>
      </div>
      <div class="content">
        <h2>Hello ${name},</h2>
        <p>Your REACH INTERNATIONAL account has been approved. You can now login to access the system.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="btn">Login to Dashboard</a>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Your REACH INTERNATIONAL Account Has Been Approved",
    html,
  });
}

export async function sendRejectionEmail(email: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Request Update</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Account Request Update</h1>
      </div>
      <div class="content">
        <h2>Hello ${name},</h2>
        <p>Thank you for your interest in REACH INTERNATIONAL. Unfortunately, your account request has been declined at this time.</p>
        <p>If you have any questions, please contact your administrator.</p>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "REACH INTERNATIONAL Account Request Update",
    html,
  });
}

export async function sendPendingApprovalEmailToAdmins(adminEmails: string[], userName: string, userEmail: string, userRole?: string) {
  const roleDisplay = userRole ? userRole.replace(/_/g, " ").toUpperCase() : "NOT SPECIFIED";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New User Pending Approval</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>New User Pending Approval</h1>
      </div>
      <div class="content">
        <p>A new user has signed up and is awaiting approval:</p>
        <div class="credentials" style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p><strong>Name:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Requested Role:</strong> ${roleDisplay}</p>
        </div>
        <p>Please review and approve/reject this request in the admin dashboard.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/users" class="btn">Go to Admin Dashboard</a>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL.</p>
      </div>
    </body>
    </html>
  `;

  const promises = adminEmails.map((email) =>
    sendEmail({
      to: email,
      subject: "New User Awaiting Approval - REACH INTERNATIONAL",
      html,
    })
  );

  return Promise.all(promises);
}

export async function sendPasswordResetNotification(email: string, name: string, newPassword: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .credentials { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Password Reset</h1>
      </div>
      <div class="content">
        <h2>Hello ${name},</h2>
        <p>Your password has been reset by an administrator. Here are your new credentials:</p>
        <div class="credentials">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>New Password:</strong> ${newPassword}</p>
        </div>
        <p>Please login at the link below:</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="btn">Login to Dashboard</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 15px;">For security, please change your password after logging in.</p>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Your REACH INTERNATIONAL Password Has Been Reset",
    html,
  });
}