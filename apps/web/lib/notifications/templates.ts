export interface ServiceReminderData {
  machineCode: string;
  machineName: string;
  customerName: string;
  customerMobile: string;
  dueDate: string;
  alertType: "today" | "tomorrow" | "overdue";
  engineerName?: string;
  daysOverdue?: number;
}

export function getServiceReminderMessage(data: ServiceReminderData): string {
  let header = "";
  let body = "";

  if (data.alertType === "today") {
    header = "🔔 *Service Due Today*";
    body = `Machine *${data.machineCode}* (${data.machineName}) is scheduled for service today.`;
  } else if (data.alertType === "tomorrow") {
    header = "📅 *Service Due Tomorrow*";
    body = `Machine *${data.machineCode}* (${data.machineName}) is scheduled for service tomorrow.`;
  } else if (data.alertType === "overdue") {
    const days = data.daysOverdue || 1;
    header = `⚠️ *Service Overdue (${days} day${days > 1 ? "s" : ""})*`;
    body = `Machine *${data.machineCode}* (${data.machineName}) service is overdue. Please attend immediately.`;
  }

  return `${header}

${body}

Customer: ${data.customerName}
Mobile: ${data.customerMobile}
Due Date: ${data.dueDate}
${data.engineerName ? `Assigned Engineer: ${data.engineerName}` : ""}

Please ensure timely service completion.`;
}

export function getDailySummaryMessage(
  todayCount: number,
  tomorrowCount: number,
  overdueCount: number,
  machines: ServiceReminderData[]
): string {
  const today = new Date().toISOString().split("T")[0];

  let message = `📊 *Daily Service Summary* - ${today}

`;
  message += `Today: ${todayCount} service${todayCount !== 1 ? "s" : ""}
`;
  message += `Tomorrow: ${tomorrowCount} service${tomorrowCount !== 1 ? "s" : ""}
`;
  message += `Overdue: ${overdueCount} machine${overdueCount !== 1 ? "s" : ""}
`;

  if (machines.length > 0) {
    message += "\n*Details:*\n";
    machines.forEach((m) => {
      const status =
        m.alertType === "today"
          ? "Today"
          : m.alertType === "tomorrow"
          ? "Tomorrow"
          : `Overdue (${m.daysOverdue || 1}d)`;
      message += `• ${m.machineCode} - ${status}\n`;
    });
  }

  message += "\nPlease check the dashboard for more details.";
  return message;
}