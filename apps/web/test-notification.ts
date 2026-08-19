import { sendNotification } from "./lib/notifications";

// Test notification to engineer with full machine details
async function testEngineerNotification() {
  const result = await sendNotification({
    to: "vaibhav1chauhan12353@gmail.com",
    channel: "email",
    subject: "Service Due Tomorrow — MCH-2024-001",
    recipientName: "Vaibhav Chauhan",
    message: `📅 *Service Due Tomorrow*

Machine *MCH-2024-001* (Hydraulic Press HM-500) is scheduled for service tomorrow.

Customer: Sharma Industries Pvt Ltd
Mobile: +91 98765 43210
Due Date: 2026-08-07
Location: Plot 45, GIDC Phase 2, Vapi, Gujarat - 396195

Assigned Engineer: Vaibhav Chauhan

Please ensure timely service completion.`,
    metadata: {
      machine_id: "test-machine-001",
      machine_code: "MCH-2024-001",
      alert_type: "tomorrow",
      due_date: "2026-08-07",
      customer_name: "Sharma Industries Pvt Ltd",
      customer_mobile: "+91 98765 43210",
      customer_address: "Plot 45, GIDC Phase 2, Vapi",
      city: "Vapi",
      state: "Gujarat",
      recipient_type: "engineer",
    },
  });

  console.log("Notification Result:", result);

  if (result.success) {
    console.log("✅ Email sent successfully!");
    console.log("Message ID:", result.messageId);
  } else {
    console.error("❌ Failed to send email:", result.error);
  }
}

testEngineerNotification();
