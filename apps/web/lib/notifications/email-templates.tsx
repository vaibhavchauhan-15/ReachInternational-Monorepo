import { escapeHtml } from "@reachinternational/utils";

export interface ServiceReminderEmailData {
  subject: string;
  message: string;
  recipientName: string;
  alertType: string;
  machineCode: string;
  dueDate: string;
  customerName?: string;
}

export function getServiceReminderEmailSubject(alertType: string, machineCode: string): string {
  const typeLabel =
    alertType === "today"
      ? "Service Due Today"
      : alertType === "tomorrow"
      ? "Service Due Tomorrow"
      : alertType === "overdue"
      ? "Service Overdue"
      : "Service Reminder";

  return `[REACH INTERNATIONAL] ${typeLabel} — ${machineCode}`;
}

export function getServiceReminderEmailHtml(data: ServiceReminderEmailData): string {
  const alertTypeLower = (data.alertType || "reminder").toLowerCase();
  const badgeColor =
    alertTypeLower === "today"
      ? "#f5a623"
      : alertTypeLower === "tomorrow"
      ? "#0070f3"
      : alertTypeLower === "overdue"
      ? "#ee0000"
      : "#8f8f8f";

  const safeSubject = escapeHtml(data.subject);
  const safeRecipientName = escapeHtml(data.recipientName);
  const safeMessage = escapeHtml(data.message);
  const safeMachineCode = escapeHtml(data.machineCode);
  const safeDueDate = escapeHtml(data.dueDate);
  const safeCustomerName = escapeHtml(data.customerName);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${safeSubject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fafafa; color: #171717; }
        .header { background: #ffffff; border: 1px solid #ebebeb; border-radius: 6px 6px 0 0; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.4px; color: #171717; }
        .header p { margin: 6px 0 0; font-size: 14px; color: #4d4d4d; }
        .content { background: #ffffff; border-left: 1px solid #ebebeb; border-right: 1px solid #ebebeb; padding: 24px; }
        .greeting { font-size: 14px; color: #171717; margin: 0 0 16px; }
        .message { font-size: 14px; line-height: 20px; color: #4d4d4d; white-space: pre-line; margin: 0 0 20px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 100px; font-size: 12px; font-weight: 500; color: #ffffff; background: ${badgeColor}; margin-bottom: 16px; }
        .info-box { background: #fafafa; border: 1px solid #ebebeb; border-radius: 6px; padding: 16px; margin: 16px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 0; font-size: 14px; color: #171717; border-bottom: 1px solid #f2f2f2; }
        td:last-child { border: none; }
        td:first-child { color: #8f8f8f; width: 35%; font-weight: 500; }
        .btn { display: inline-block; background: #171717; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 100px; margin-top: 20px; font-size: 16px; font-weight: 500; }
        .footer { background: #ffffff; border: 1px solid #ebebeb; border-radius: 0 0 6px 6px; text-align: center; padding: 20px; }
        .footer p { margin: 4px 0; color: #8f8f8f; font-size: 12px; line-height: 16px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>REACH INTERNATIONAL</h1>
        <p>Service Notification</p>
      </div>
      <div class="content">
        <p class="greeting">Hello <strong>${safeRecipientName}</strong>,</p>
        <span class="badge">${alertTypeLower === "today" ? "Due Today" : alertTypeLower === "tomorrow" ? "Due Tomorrow" : "Overdue"}</span>
        <p class="message">${safeMessage}</p>
        <div class="info-box">
          <table>
            <tr>
              <td>Machine</td>
              <td><strong>${safeMachineCode}</strong></td>
            </tr>
            ${data.dueDate ? `<tr><td>Due Date</td><td><strong>${safeDueDate}</strong></td></tr>` : ""}
            ${data.customerName ? `<tr><td>Customer</td><td><strong>${safeCustomerName}</strong></td></tr>` : ""}
          </table>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard" class="btn">View Dashboard</a>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL Service Management System.</p>
        <p>Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
}

export interface DailySummaryEmailData {
  date: string;
  todayCount: number;
  tomorrowCount: number;
  overdueCount: number;
  engineerBreakdown: { engineerName: string; count: number }[];
  machines: { code: string; name: string; dueDate: string; alertType: string; engineerName?: string }[];
  dashboardUrl: string;
}

export function getDailySummaryEmailHtml(data: DailySummaryEmailData): string {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Service Summary - REACH INTERNATIONAL</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .summary { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .stat-box { background: white; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #e5e7eb; }
        .stat-value { font-size: 32px; font-weight: bold; color: #2563eb; }
        .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
        .section { margin: 25px 0; }
        .section-title { font-size: 18px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f3f4f6; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #e5e7eb; }
        td { padding: 10px; border: 1px solid #e5e7eb; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge-today { background: #fef3c7; color: #92400e; }
        .badge-tomorrow { background: #dbeafe; color: #1e40af; }
        .badge-overdue { background: #fee2e2; color: #991b1b; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Daily Service Summary</h1>
        <p>REACH INTERNATIONAL - ${data.date}</p>
      </div>

      <div class="summary">
        <h2 style="margin-top: 0;">Service Overview</h2>
        <div class="stats">
          <div class="stat-box">
            <div class="stat-value">${data.todayCount}</div>
            <div class="stat-label">Today</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.tomorrowCount}</div>
            <div class="stat-label">Tomorrow</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.overdueCount}</div>
            <div class="stat-label">Overdue</div>
          </div>
        </div>
      </div>
  `;

  if (data.engineerBreakdown.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">Engineers</div>
        <table>
          <thead>
            <tr><th>Engineer</th><th>Machines</th></tr>
          </thead>
          <tbody>
      `;

    data.engineerBreakdown.forEach((eng) => {
      html += `<tr><td>${eng.engineerName || "Unassigned"}</td><td><strong>${eng.count}</strong></td></tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  if (data.machines.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">Machine Details</div>
        <table>
          <thead>
            <tr>
              <th>Machine</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Engineer</th>
            </tr>
          </thead>
          <tbody>
    `;

    data.machines.forEach((machine) => {
      const badgeClass = machine.alertType === "today" ? "badge-today" : machine.alertType === "tomorrow" ? "badge-tomorrow" : "badge-overdue";
      html += `
        <tr>
          <td><strong>${machine.code}</strong><br><small>${machine.name}</small></td>
          <td>${machine.dueDate}</td>
          <td><span class="badge ${badgeClass}">${machine.alertType.toUpperCase()}</span></td>
          <td>${machine.engineerName || "—"}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  html += `
      <div style="text-align: center; margin-top: 30px;">
        <a href="${data.dashboardUrl}" class="btn">View Dashboard</a>
      </div>

      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL Service Management System.</p>
        <p>Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function getDailySummaryEmailText(data: DailySummaryEmailData): string {
  let text = `REACH INTERNATIONAL - Daily Service Summary (${data.date})\n\n`;
  text += `Today: ${data.todayCount} services\n`;
  text += `Tomorrow: ${data.tomorrowCount} services\n`;
  text += `Overdue: ${data.overdueCount} machines\n\n`;

  if (data.engineerBreakdown.length > 0) {
    text += `Engineers:\n`;
    data.engineerBreakdown.forEach((eng) => {
      text += `- ${eng.engineerName || "Unassigned"}: ${eng.count}\n`;
    });
    text += "\n";
  }

  if (data.machines.length > 0) {
    text += `Machines:\n`;
    data.machines.forEach((machine) => {
      text += `- ${machine.code} (${machine.dueDate}) - ${machine.alertType.toUpperCase()}`;
      if (machine.engineerName) text += ` - ${machine.engineerName}`;
      text += "\n";
    });
  }

  text += `\nView Dashboard: ${data.dashboardUrl}`;
  return text;
}

export function getImportCompletedEmailHtml(filename: string, totalRows: number, successCount: number, failedCount: number): string {
  const safeFilename = escapeHtml(filename);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Import Completed - REACH INTERNATIONAL</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
        .stat-box { background: white; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Excel Import Completed</h1>
      </div>
      <div class="content">
        <h2>File: ${safeFilename}</h2>
        <div class="stats">
          <div class="stat-box">
            <div class="stat-value">${totalRows}</div>
            <div class="stat-label">Total Rows</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: #16a34a;">${successCount}</div>
            <div class="stat-label">Successful</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="color: #dc2626;">${failedCount}</div>
            <div class="stat-label">Failed</div>
          </div>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL.</p>
      </div>
    </body>
    </html>
  `;
}

export function getReminderFailedEmailHtml(failedCount: number, errors: { machineCode: string; error: string }[]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reminder Failures - REACH INTERNATIONAL</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .error-box { background: #fee2e2; border: 1px solid #dc2626; padding: 15px; margin: 10px 0; border-radius: 6px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⚠️ Reminder Sending Failed</h1>
      </div>
      <div class="content">
        <h2>${failedCount} reminder(s) failed to send</h2>
        <p>Please review the errors below and take corrective action:</p>
        ${errors.map((err) => `
          <div class="error-box">
            <strong>${escapeHtml(err.machineCode)}</strong><br>
            Error: ${escapeHtml(err.error)}
          </div>
        `).join("")}
      </div>
      <div class="footer">
        <p>This is an automated email from REACH INTERNATIONAL.</p>
      </div>
    </body>
    </html>
  `;
}

// ============================================
// Daily Summary Email — Super Admin
// ============================================

export interface AdminSummaryMachine {
  machineCode: string;
  machineName: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  engineerName?: string;
  engineerPhone?: string;
  engineerEmail?: string;
  dueDate?: string;
  daysOverdue?: number;
  lastServiceDate?: string;
}

export interface AdminSummaryCompletedService {
  machineCode: string;
  machineName: string;
  engineerName: string;
  completionTime: string;
  notes?: string;
  nextServiceDueDate?: string;
}

export interface AdminSummaryNotificationStats {
  emailsSent: number;
  emailsFailed: number;
  whatsappSent: number;
  whatsappFailed: number;
  smsSent: number;
  smsFailed: number;
}

export interface AdminDailySummaryData {
  date: string;
  recipientName: string;
  dashboardUrl: string;
  kpis: {
    totalActiveMachines: number;
    machinesAddedToday: number;
    servicesCompletedToday: number;
    machinesDueToday: number;
    machinesDueTomorrow: number;
    overdueMachines: number;
    failedNotificationsToday: number;
    successfulNotificationsToday: number;
  };
  newMachinesToday: AdminSummaryMachine[];
  dueTomorrowMachines: AdminSummaryMachine[];
  overdueMachines: AdminSummaryMachine[];
  completedServicesToday: AdminSummaryCompletedService[];
  notificationStats: AdminSummaryNotificationStats;
}



export function getAdminDailySummaryEmailHtml(data: AdminDailySummaryData): string {
  const kpiCards = [
    { label: "Active Machines", value: data.kpis.totalActiveMachines, color: "#171717" },
    { label: "Added Today", value: data.kpis.machinesAddedToday, color: "#0070f3" },
    { label: "Completed Today", value: data.kpis.servicesCompletedToday, color: "#16a34a" },
    { label: "Due Today", value: data.kpis.machinesDueToday, color: "#f5a623" },
    { label: "Due Tomorrow", value: data.kpis.machinesDueTomorrow, color: "#0070f3" },
    { label: "Overdue", value: data.kpis.overdueMachines, color: "#ee0000" },
    { label: "Alerts Sent", value: data.kpis.successfulNotificationsToday, color: "#16a34a" },
    { label: "Alerts Failed", value: data.kpis.failedNotificationsToday, color: "#ee0000" },
  ];

  const newMachinesRows = data.newMachinesToday
    .map(
      (m) => `<tr>
            <td><strong>${escapeHtml(m.machineCode)}</strong><br><small>${escapeHtml(m.machineName)}</small></td>
            <td>${escapeHtml(m.customerName)}<br><small>${escapeHtml(m.customerPhone)}</small></td>
            <td>${escapeHtml(m.customerCity)}</td>
            <td>${escapeHtml(m.engineerName) || "—"}</td>
            <td>${escapeHtml(m.dueDate) || "—"}</td>
          </tr>`
    )
    .join("");

  const dueTomorrowRows = data.dueTomorrowMachines
    .map(
      (m) => `<tr>
            <td><strong>${escapeHtml(m.machineCode)}</strong><br><small>${escapeHtml(m.machineName)}</small></td>
            <td>${escapeHtml(m.customerName)}<br><small>${escapeHtml(m.customerPhone)}</small></td>
            <td>${escapeHtml(m.customerAddress) || "—"}</td>
            <td>${escapeHtml(m.customerCity)}</td>
            <td><span class="badge badge-tomorrow">${escapeHtml(m.dueDate)}</span></td>
            <td>${escapeHtml(m.engineerName) || "—"}<br><small>${escapeHtml(m.engineerPhone) || ""}</small><br><small>${escapeHtml(m.engineerEmail) || ""}</small></td>
          </tr>`
    )
    .join("");

  const overdueRows = data.overdueMachines
    .map(
      (m) => `<tr>
            <td><strong>${escapeHtml(m.machineCode)}</strong><br><small>${escapeHtml(m.machineName)}</small></td>
            <td>${escapeHtml(m.customerName)}<br><small>${escapeHtml(m.customerPhone)}</small></td>
            <td><span class="badge badge-overdue">${m.daysOverdue ?? 1}d</span></td>
            <td>${escapeHtml(m.engineerName) || "—"}</td>
            <td>${escapeHtml(m.lastServiceDate) || "—"}</td>
          </tr>`
    )
    .join("");

  const completedRows = data.completedServicesToday
    .map(
      (s) => `<tr>
            <td><strong>${escapeHtml(s.machineCode)}</strong><br><small>${escapeHtml(s.machineName)}</small></td>
            <td>${escapeHtml(s.engineerName)}</td>
            <td>${escapeHtml(s.completionTime)}</td>
            <td>${escapeHtml(s.notes) || "—"}</td>
            <td>${escapeHtml(s.nextServiceDueDate) || "—"}</td>
          </tr>`
    )
    .join("");

  const kpiCardsHtml = kpiCards
    .map(
      (k) => `<div class="kpi-card">
              <div class="kpi-value" style="color:${k.color}">${k.value}</div>
              <div class="kpi-label">${k.label}</div>
            </div>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Daily Operations Summary — REACH INTERNATIONAL — ${data.date}</title>
      <style>
        :root { color-scheme: light dark; supported-color-schemes: light dark; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 880px; margin: 0 auto; padding: 20px; background: #fafafa; color: #171717; }
        .header { background: #ffffff; border: 1px solid #ebebeb; border-radius: 6px 6px 0 0; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.4px; color: #171717; }
        .header p { margin: 8px 0 0; font-size: 14px; color: #4d4d4d; }
        .content { background: #ffffff; border-left: 1px solid #ebebeb; border-right: 1px solid #ebebeb; border-bottom: 1px solid #ebebeb; border-radius: 0 0 6px 6px; padding: 28px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 0 0 32px; }
        .kpi-card { background: #fafafa; border: 1px solid #ebebeb; border-radius: 6px; padding: 16px; text-align: center; }
        .kpi-value { font-size: 32px; font-weight: 600; line-height: 1; letter-spacing: -1px; }
        .kpi-label { font-size: 12px; color: #8f8f8f; margin-top: 8px; font-weight: 500; }
        .section { margin: 32px 0; }
        .section-title { font-size: 16px; font-weight: 600; color: #171717; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #ebebeb; letter-spacing: -0.3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
        th { background: #fafafa; padding: 12px; text-align: left; font-weight: 600; color: #171717; border: 1px solid #ebebeb; font-size: 12px; }
        td { padding: 12px; border: 1px solid #f2f2f2; vertical-align: top; color: #171717; }
        tr:nth-child(even) td { background: #fafafa; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 500; color: #ffffff; }
        .badge-overdue { background: #ee0000; }
        .badge-tomorrow { background: #0070f3; }
        .badge-today { background: #f5a623; }
        .notif-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
        .notif-card { background: #fafafa; border: 1px solid #ebebeb; border-radius: 6px; padding: 16px; }
        .notif-card h4 { margin: 0 0 12px; font-size: 12px; color: #8f8f8f; font-weight: 500; }
        .notif-row { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; color: #171717; }
        .notif-sent { color: #16a34a; font-weight: 600; }
        .notif-failed { color: #ee0000; font-weight: 600; }
        .btn { display: inline-block; background: #171717; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 100px; margin-top: 24px; font-weight: 500; font-size: 16px; }
        .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #ebebeb; color: #8f8f8f; font-size: 12px; }
        .timestamp { display: inline-block; margin-top: 8px; font-size: 11px; color: #a1a1a1; }
        @media (max-width: 600px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .notif-grid { grid-template-columns: 1fr; }
          table { font-size: 13px; }
          th, td { padding: 10px; }
        }
        @media (prefers-color-scheme: dark) {
          body { background: #0f0f0f; color: #ededed; }
          .header { background: #1a1a1a; border-color: #2a2a2a; }
          .header h1 { color: #ededed; }
          .header p { color: #a0a0a0; }
          .content { background: #1a1a1a; border-color: #2a2a2a; }
          .kpi-card, .notif-card { background: #0f0f0f; border-color: #2a2a2a; }
          .kpi-label, .notif-card h4 { color: #a0a0a0; }
          .kpi-value { color: #ededed; }
          th { background: #0f0f0f; color: #ededed; border-color: #2a2a2a; }
          td { border-color: #2a2a2a; color: #ededed; }
          tr:nth-child(even) td { background: #0f0f0f; }
          .section-title { color: #ededed; border-color: #2a2a2a; }
          .notif-row { color: #ededed; }
          .footer { border-color: #2a2a2a; color: #a0a0a0; }
          .timestamp { color: #787878; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Daily Operations Summary</h1>
        <p>${escapeHtml(data.recipientName)} • ${data.date}</p>
      </div>
      <div class="content">
        <div class="kpi-grid">
          ${kpiCardsHtml}
        </div>

        <div class="section">
          <div class="section-title">🆕 Machines Added Today</div>
          ${
            data.newMachinesToday.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">No new machines were added today.</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Customer</th><th>City</th><th>Engineer</th><th>Service Due</th></tr></thead>
              <tbody>${newMachinesRows}</tbody>
            </table>`
          }
        </div>

        <div class="section">
          <div class="section-title">📅 Machines Due Tomorrow</div>
          ${
            data.dueTomorrowMachines.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">No machines are due tomorrow.</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Customer / Contact</th><th>Address</th><th>City</th><th>Due Date</th><th>Engineer</th></tr></thead>
              <tbody>${dueTomorrowRows}</tbody>
            </table>`
          }
        </div>

        <div class="section">
          <div class="section-title">⚠️ Overdue Machines (longest overdue first)</div>
          ${
            data.overdueMachines.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">No overdue machines. 🎉</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Customer</th><th>Days Overdue</th><th>Engineer</th><th>Last Service</th></tr></thead>
              <tbody>${overdueRows}</tbody>
            </table>`
          }
        </div>

        <div class="section">
          <div class="section-title">✅ Services Completed Today</div>
          ${
            data.completedServicesToday.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">No services were completed today.</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Engineer</th><th>Completed</th><th>Notes</th><th>Next Due</th></tr></thead>
              <tbody>${completedRows}</tbody>
            </table>`
          }
        </div>

        <div class="section">
          <div class="section-title">📬 Notification Summary</div>
          <div class="notif-grid">
            <div class="notif-card">
              <h4>Email</h4>
              <div class="notif-row"><span>Sent</span><span class="notif-sent">${data.notificationStats.emailsSent}</span></div>
              <div class="notif-row"><span>Failed</span><span class="notif-failed">${data.notificationStats.emailsFailed}</span></div>
            </div>
            <div class="notif-card">
              <h4>WhatsApp</h4>
              <div class="notif-row"><span>Sent</span><span class="notif-sent">${data.notificationStats.whatsappSent}</span></div>
              <div class="notif-row"><span>Failed</span><span class="notif-failed">${data.notificationStats.whatsappFailed}</span></div>
            </div>
            <div class="notif-card">
              <h4>SMS</h4>
              <div class="notif-row"><span>Sent</span><span class="notif-sent">${data.notificationStats.smsSent}</span></div>
              <div class="notif-row"><span>Failed</span><span class="notif-failed">${data.notificationStats.smsFailed}</span></div>
            </div>
          </div>
        </div>

        <div style="text-align:center;">
          <a href="${data.dashboardUrl}" class="btn">Open Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated daily summary from REACH INTERNATIONAL Service Management System.</p>
        <p>Please do not reply to this email.</p>
        <span class="timestamp">Generated at ${new Date().toISOString()}</span>
      </div>
    </body>
    </html>
  `;
}

export function getAdminDailySummaryEmailText(data: AdminDailySummaryData): string {
  let text = `REACH INTERNATIONAL — Daily Operations Summary (${data.date})\n\n`;
  text += `Hello ${data.recipientName},\n\n`;
  text += `KPIs:\n`;
  text += `- Active Machines: ${data.kpis.totalActiveMachines}\n`;
  text += `- Added Today: ${data.kpis.machinesAddedToday}\n`;
  text += `- Completed Today: ${data.kpis.servicesCompletedToday}\n`;
  text += `- Due Today: ${data.kpis.machinesDueToday}\n`;
  text += `- Due Tomorrow: ${data.kpis.machinesDueTomorrow}\n`;
  text += `- Overdue: ${data.kpis.overdueMachines}\n`;
  text += `- Alerts Sent Today: ${data.kpis.successfulNotificationsToday}\n`;
  text += `- Alerts Failed Today: ${data.kpis.failedNotificationsToday}\n\n`;

  if (data.newMachinesToday.length > 0) {
    text += `New Machines Today:\n`;
    data.newMachinesToday.forEach((m) => {
      text += `- ${m.machineCode} (${m.machineName}) — ${m.customerName}, ${m.customerCity}\n`;
    });
    text += "\n";
  }

  if (data.dueTomorrowMachines.length > 0) {
    text += `Due Tomorrow:\n`;
    data.dueTomorrowMachines.forEach((m) => {
      text += `- ${m.machineCode} (${m.machineName}) — ${m.customerName}, ${m.customerCity} — Engineer: ${m.engineerName || "—"}\n`;
    });
    text += "\n";
  }

  if (data.overdueMachines.length > 0) {
    text += `Overdue:\n`;
    data.overdueMachines.forEach((m) => {
      text += `- ${m.machineCode} (${m.daysOverdue ?? 1}d overdue) — ${m.customerName} — Engineer: ${m.engineerName || "—"}\n`;
    });
    text += "\n";
  }

  if (data.completedServicesToday.length > 0) {
    text += `Completed Today:\n`;
    data.completedServicesToday.forEach((s) => {
      text += `- ${s.machineCode} — ${s.engineerName} — ${s.completionTime}\n`;
    });
    text += "\n";
  }

  text += `Notifications — Email: ${data.notificationStats.emailsSent} sent / ${data.notificationStats.emailsFailed} failed\n`;
  text += `WhatsApp: ${data.notificationStats.whatsappSent} sent / ${data.notificationStats.whatsappFailed} failed\n`;
  text += `SMS: ${data.notificationStats.smsSent} sent / ${data.notificationStats.smsFailed} failed\n\n`;
  text += `Open Dashboard: ${data.dashboardUrl}\n`;
  return text;
}

// ============================================
// Daily Summary Email — Engineer
// ============================================

export interface EngineerSummaryMachine {
  machineCode: string;
  machineName: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerCity: string;
  dueDate?: string;
  daysOverdue?: number;
  lastServiceDate?: string;
}

export interface EngineerSummaryCompletedService {
  machineCode: string;
  machineName: string;
  completionTime: string;
  notes?: string;
  nextServiceDueDate?: string;
}

export interface EngineerDailySummaryData {
  date: string;
  recipientName: string;
  dashboardUrl: string;
  dueTomorrowMachines: EngineerSummaryMachine[];
  overdueMachines: EngineerSummaryMachine[];
  completedServicesToday: EngineerSummaryCompletedService[];
}

export function getEngineerDailySummaryEmailHtml(data: EngineerDailySummaryData): string {
  const dueTomorrowRows = data.dueTomorrowMachines
    .map(
      (m) => `<tr>
            <td><strong>${escapeHtml(m.machineCode)}</strong><br><small>${escapeHtml(m.machineName)}</small></td>
            <td>${escapeHtml(m.customerName)}<br><small>${escapeHtml(m.customerPhone)}</small></td>
            <td>${escapeHtml(m.customerAddress) || "—"}</td>
            <td>${escapeHtml(m.customerCity)}</td>
            <td><span class="badge badge-tomorrow">${escapeHtml(m.dueDate)}</span></td>
          </tr>`
    )
    .join("");

  const overdueRows = data.overdueMachines
    .map(
      (m) => `<tr>
            <td><strong>${escapeHtml(m.machineCode)}</strong><br><small>${escapeHtml(m.machineName)}</small></td>
            <td>${escapeHtml(m.customerName)}<br><small>${escapeHtml(m.customerPhone)}</small></td>
            <td><span class="badge badge-overdue">${m.daysOverdue ?? 1}d</span></td>
            <td>${escapeHtml(m.lastServiceDate) || "—"}</td>
          </tr>`
    )
    .join("");

  const completedRows = data.completedServicesToday
    .map(
      (s) => `<tr>
            <td><strong>${escapeHtml(s.machineCode)}</strong><br><small>${escapeHtml(s.machineName)}</small></td>
            <td>${escapeHtml(s.completionTime)}</td>
            <td>${escapeHtml(s.notes) || "—"}</td>
            <td>${escapeHtml(s.nextServiceDueDate) || "—"}</td>
          </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Your Daily Service Summary — REACH INTERNATIONAL — ${data.date}</title>
      <style>
        :root { color-scheme: light dark; supported-color-schemes: light dark; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 20px; color: #1f2937; background: #f9fafb; }
        .header { background: linear-gradient(135deg, #0f766e, #0d9488); color: #ffffff; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .header p { margin: 6px 0 0; opacity: 0.9; font-size: 13px; }
        .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
        .section { margin: 24px 0; }
        .section-title { font-size: 16px; font-weight: 700; color: #0f766e; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th { background: #f0fdfa; padding: 10px; text-align: left; font-weight: 700; color: #134e4a; border: 1px solid #ccfbf1; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
        td { padding: 10px; border: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .badge-overdue { background: #fee2e2; color: #991b1b; }
        .badge-tomorrow { background: #dbeafe; color: #1e40af; }
        .reminder { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; margin: 20px 0; }
        .reminder h3 { margin: 0 0 6px; color: #047857; font-size: 15px; }
        .reminder p { margin: 0; color: #065f46; font-size: 13px; }
        .btn { display: inline-block; background: #0d9488; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: 700; font-size: 14px; }
        .footer { text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        .timestamp { display: inline-block; margin-top: 4px; font-size: 11px; color: #94a3b8; }
        @media (max-width: 600px) {
          table { font-size: 12px; }
          th, td { padding: 8px; }
        }
        @media (prefers-color-scheme: dark) {
          body { background: #0b1220; color: #e2e8f0; }
          .content { background: #111827; border-color: #1f2937; }
          th { background: #042f2e; color: #99f6e4; border-color: #134e4a; }
          td { border-color: #1f2937; }
          tr:nth-child(even) td { background: #0f172a; }
          .section-title { color: #5eead4; border-color: #1f2937; }
          .reminder { background: #042f2e; border-color: #134e4a; }
          .reminder h3 { color: #6ee7b7; }
          .reminder p { color: #a7f3d0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Your Daily Service Summary</h1>
        <p>${escapeHtml(data.recipientName)} • ${data.date}</p>
      </div>
      <div class="content">
        <div class="section">
          <div class="section-title">📅 Machines Due Tomorrow</div>
          ${
            data.dueTomorrowMachines.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">You have no machines due tomorrow.</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Customer / Contact</th><th>Address</th><th>City</th><th>Due Date</th></tr></thead>
              <tbody>${dueTomorrowRows}</tbody>
            </table>`
          }
        </div>

        <div class="section">
          <div class="section-title">⚠️ Your Overdue Machines</div>
          ${
            data.overdueMachines.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">No overdue machines assigned to you. 🎉</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Customer / Contact</th><th>Days Overdue</th><th>Last Service</th></tr></thead>
              <tbody>${overdueRows}</tbody>
            </table>`
          }
        </div>

        <div class="section">
          <div class="section-title">✅ Services You Completed Today</div>
          ${
            data.completedServicesToday.length === 0
              ? `<p style="color:#6b7280;font-size:13px;">You haven't logged any services today.</p>`
              : `<table>
              <thead><tr><th>Code / Name</th><th>Completed</th><th>Notes</th><th>Next Due</th></tr></thead>
              <tbody>${completedRows}</tbody>
            </table>`
          }
        </div>

        <div class="reminder">
          <h3>🔔 Friendly Reminder</h3>
          <p>Please complete all due services on time and log them in REACH INTERNATIONAL. Timely service keeps our customers happy and avoids overdue escalations.</p>
        </div>

        <div style="text-align:center;">
          <a href="${data.dashboardUrl}" class="btn">Open Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated daily summary from REACH INTERNATIONAL Service Management System.</p>
        <p>Please do not reply to this email.</p>
        <span class="timestamp">Generated at ${new Date().toISOString()}</span>
      </div>
    </body>
    </html>
  `;
}

export function getEngineerDailySummaryEmailText(data: EngineerDailySummaryData): string {
  let text = `REACH INTERNATIONAL — Your Daily Service Summary (${data.date})\n\n`;
  text += `Hello ${data.recipientName},\n\n`;

  if (data.dueTomorrowMachines.length > 0) {
    text += `Due Tomorrow:\n`;
    data.dueTomorrowMachines.forEach((m) => {
      text += `- ${m.machineCode} (${m.machineName}) — ${m.customerName}, ${m.customerCity} — ${m.dueDate}\n`;
    });
    text += "\n";
  }

  if (data.overdueMachines.length > 0) {
    text += `Overdue:\n`;
    data.overdueMachines.forEach((m) => {
      text += `- ${m.machineCode} (${m.daysOverdue ?? 1}d overdue) — ${m.customerName}\n`;
    });
    text += "\n";
  }

  if (data.completedServicesToday.length > 0) {
    text += `Completed Today:\n`;
    data.completedServicesToday.forEach((s) => {
      text += `- ${s.machineCode} — ${s.completionTime}\n`;
    });
    text += "\n";
  }

  text += `Reminder: Please complete all due services on time and log them in REACH INTERNATIONAL.\n\n`;
  text += `Open Dashboard: ${data.dashboardUrl}\n`;
  return text;
}