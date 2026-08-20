// Load environment variables FIRST before any imports
// Run with: npx tsx test-notifications.ts (after setting up .env)
import "dotenv/config";
import { sendEmail } from "./lib/email";
import { sendNotification } from "./lib/notifications";

async function testNotifications() {
  console.log("Starting notification tests...\n");

  const testEmail = "vaibhav3chauhan12353@gmail.com";
  const testMessage = "Hello from ReachInternational - Test Email Notification";

  // Test Email
  console.log("1. Testing SendGrid Email...");
  try {
    const emailResult = await sendEmail({
      to: testEmail,
      subject: "Notification System Test",
      html: `<h1>Test Email</h1><p>${testMessage}</p>`,
      text: testMessage,
    });
    console.log("Email Result:", emailResult);
    console.log(emailResult ? "✅ Email: PASSED\n" : "❌ Email: FAILED\n");
  } catch (error: unknown) {
    console.error("❌ Email: FAILED with exception:");

    if (error && typeof error === "object" && "response" in error) {
      const response = (error as { response?: { body?: unknown; headers?: unknown } }).response;
      console.dir(response?.body, { depth: null, colors: true });
      console.dir(response?.headers);
    }

    console.error(error);
  }

  // Test sendNotification with email channel
  console.log("2. Testing sendNotification (email channel)...");
  try {
    const result = await sendNotification({
      to: testEmail,
      channel: "email",
      message: testMessage,
      subject: "ReachInternational - Test Notification",
      recipientName: "Vaibhav Chauhan",
      metadata: {
        machine_id: "test-uuid",
        machine_code: "RI-0003",
        alert_type: "today",
        due_date: "03 Aug 2026",
        customer_name: "Reach Industries Pvt Ltd",
      },
    });
    console.log("sendNotification Result:", result);
    console.log(result.success ? "✅ sendNotification: PASSED\n" : "❌ sendNotification: FAILED\n");
  } catch (error: unknown) {
    console.error("❌ sendNotification: FAILED with exception:");

    if (error && typeof error === "object" && "response" in error) {
      const response = (error as { response?: { body?: unknown; headers?: unknown } }).response;
      console.dir(response?.body, { depth: null, colors: true });
      console.dir(response?.headers);
    }

    console.error(error);
  }

  // WhatsApp and SMS are kept for future use — they can be tested separately
  // once Twilio credentials are configured properly.
  console.log("3. WhatsApp and SMS channels are kept for future use.");
  console.log("   They will work once Twilio credentials are fixed.");

  console.log("\nAll tests completed!");
}

testNotifications().catch(console.error);