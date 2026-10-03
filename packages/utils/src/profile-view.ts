import { maskAadhaar } from "./string";
import { formatDate, formatShiftTimingRange, parseTimeToMinutes, parseProfileShiftTime } from "./date";

export interface ProfileRow {
  label: string;
  value: string;
  copyable?: boolean;
  copyValue?: string;
  isMonospace?: boolean;
  href?: string;
  badge?: {
    label: string;
    variant?: "success" | "warning" | "neutral" | "info";
  };
}

export interface ProfileSection {
  title: string;
  iconName: "briefcase" | "credit-card" | "building" | "shield" | "map-pin" | "phone" | "user";
  rows: ProfileRow[];
}

export interface ProfileViewModel {
  name: string;
  role: string;
  status: string;
  email: string;
  shiftTimingDisplay: string;
  joinedDateDisplay?: string | null;
  sections: ProfileSection[];
}

/**
 * Computes human-friendly shift timing display with 12-hour AM/PM format and duration.
 * e.g. "06:00 AM — 12:00 PM (6 hrs)" or "09:00 AM — 06:00 PM (9 hrs)"
 */
export function computeShiftDisplay(
  start?: string | null,
  end?: string | null,
  legacy?: string | null
): string {
  if (start && end) {
    const range = formatShiftTimingRange(start, end);
    const sMins = parseTimeToMinutes(start);
    const eMins = parseTimeToMinutes(end);
    if (sMins !== null && eMins !== null) {
      let diff = eMins - sMins;
      if (diff <= 0) diff += 24 * 60; // handles overnight shifts
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      const dur = m > 0 ? `${h}h ${m}m` : `${h} hrs`;
      return `${range} (${dur})`;
    }
    return range;
  }
  if (legacy) {
    const parsed = parseProfileShiftTime(legacy);
    if (parsed) {
      return computeShiftDisplay(parsed.startTime, parsed.endTime, null);
    }
    return legacy;
  }
  return "General Shift (09:00 AM — 06:00 PM)";
}

/**
 * Builds a comprehensive view model for the /profile page.
 * Displays work shift, machinery assignments, supervisor, banking details,
 * compensation, leave quota/balance, identity, address, and contact info.
 */
export function toProfileView(
  u: (Record<string, any>) | null | undefined
): ProfileViewModel {
  if (!u) {
    return {
      name: "",
      role: "",
      status: "",
      email: "",
      shiftTimingDisplay: "General Shift (09:00 AM — 06:00 PM)",
      sections: [],
    };
  }

  const clean = (val: unknown): string | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str === "" || str === "—" ? null : str;
  };

  const supervisorName =
    u.supervisor?.full_name ||
    u.supervisor_name ||
    (["super_admin", "admin"].includes(u.role || "")
      ? "Executive Oversight"
      : null);

  const locationName =
    u.working_location?.name ||
    u.working_location_name ||
    [u.street, u.city, u.state].filter(Boolean).join(", ") ||
    [u.city, u.state].filter(Boolean).join(", ") ||
    null;

  const shiftDisplay = computeShiftDisplay(
    u.shift_start_time,
    u.shift_end_time,
    u.shift_time
  );

  // Machinery fleet assignment display
  let machinesDisplay: string | null = null;
  let machineHref: string | undefined = undefined;
  if (Array.isArray(u.assigned_machines) && u.assigned_machines.length > 0) {
    machinesDisplay = u.assigned_machines
      .map((m: any) => `${m.machine_id} (${m.model || m.machine_name})`)
      .join(", ");
    if (u.assigned_machines.length === 1) {
      machineHref = `/machines/${u.assigned_machines[0].id}`;
    }
  } else if (u.role === "operator" || u.role === "supervisor") {
    machinesDisplay = "None currently assigned";
  } else if (["super_admin", "admin", "manager"].includes(u.role || "")) {
    machinesDisplay = "Fleet-wide Management";
  }

  // Work & Operations rows
  const workRows: ProfileRow[] = [
    {
      label: "Shift Timing",
      value: shiftDisplay,
      isMonospace: false,
    },
    ...(machinesDisplay
      ? [
          {
            label: "Assigned Machinery",
            value: machinesDisplay,
            href: machineHref,
          },
        ]
      : []),
    {
      label: "Site Supervisor",
      value: supervisorName || "Not Assigned",
    },
    {
      label: "Working Location",
      value: locationName || "Main Facility",
    },
    {
      label: "Date of Joining",
      value: u.doj ? formatDate(u.doj) : u.created_at ? formatDate(u.created_at) : "Not Configured",
    },
    {
      label: "Profile Status",
      value: u.complete_profile ? "Complete (100%)" : "Incomplete (Update in Profile)",
      badge: {
        label: u.complete_profile ? "100% COMPLETE" : "INCOMPLETE",
        variant: u.complete_profile ? "success" : "warning",
      },
    },
  ];

  // Compensation & Payroll rows
  const compRows: ProfileRow[] = [];
  if (u.monthly_salary !== null && u.monthly_salary !== undefined) {
    compRows.push({
      label: "Monthly Base Salary",
      value: `₹${Number(u.monthly_salary).toLocaleString("en-IN")} / month`,
      isMonospace: true,
    });
  }
  if (u.daily_rate && Number(u.daily_rate) > 0) {
    compRows.push({
      label: "Daily Wage Rate",
      value: `₹${Number(u.daily_rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / day`,
      isMonospace: true,
    });
  }
  if (u.ot_hourly_rate && Number(u.ot_hourly_rate) > 0) {
    compRows.push({
      label: "Overtime Hourly Rate",
      value: `₹${Number(u.ot_hourly_rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / hr`,
      isMonospace: true,
    });
  }
  const plQuota = u.total_pl_quota !== null && u.total_pl_quota !== undefined ? Number(u.total_pl_quota) : 12;
  const plUsed = u.pl_used_as_on_date !== null && u.pl_used_as_on_date !== undefined ? Number(u.pl_used_as_on_date) : 0;
  compRows.push({
    label: "Annual PL Quota",
    value: `${plQuota} Days / year`,
  });
  compRows.push({
    label: "Available PL Balance",
    value: `${Math.max(0, plQuota - plUsed)} Days available (${plUsed} used)`,
  });

  // Banking Details rows
  const bankRows: ProfileRow[] = [
    {
      label: "Bank Account Number",
      value: clean(u.bank_account_number) || "Not Configured",
      copyable: Boolean(clean(u.bank_account_number)),
      copyValue: clean(u.bank_account_number) || undefined,
      isMonospace: true,
    },
    {
      label: "Bank IFSC Code",
      value: clean(u.bank_ifsc_code) || "Not Configured",
      copyable: Boolean(clean(u.bank_ifsc_code)),
      copyValue: clean(u.bank_ifsc_code) || undefined,
      isMonospace: true,
    },
  ];

  // Identity & Statutory rows
  const identityRows: ProfileRow[] = [
    {
      label: "Aadhaar",
      value: u.aadhaar_number ? maskAadhaar(u.aadhaar_number) : "Not Provided",
      copyable: Boolean(u.aadhaar_number),
      copyValue: u.aadhaar_number ? String(u.aadhaar_number).replace(/[\s\-]/g, "") : undefined,
      isMonospace: true,
    },
    {
      label: "Driving licence",
      value: clean(u.license_number) || "Not Provided",
      copyable: Boolean(clean(u.license_number)),
      copyValue: clean(u.license_number) || undefined,
      isMonospace: true,
    },
    ...(u.state_id
      ? [
          {
            label: "State Region ID",
            value: `Code ${u.state_id} (${u.state || "India"})`,
            isMonospace: true,
          },
        ]
      : []),
  ];

  // Residential Address rows
  const addressRows: ProfileRow[] = [
    {
      label: "Street Address",
      value: clean(u.street) || clean(u.address) || "Not Provided",
    },
    {
      label: "City / Town",
      value: clean(u.city) || "Not Provided",
    },
    {
      label: "District",
      value: clean(u.district) || "Not Provided",
    },
    {
      label: "State",
      value: clean(u.state) || "Not Provided",
    },
  ];

  // Contact Information rows
  const contactRows: ProfileRow[] = [
    {
      label: "Primary Email",
      value: clean(u.email) || "Not Provided",
      copyable: Boolean(clean(u.email)),
      copyValue: clean(u.email) || undefined,
    },
    {
      label: "Mobile Phone",
      value: u.phone ? (u.phone.startsWith("+") ? u.phone : `+91 ${u.phone}`) : "Not Provided",
      copyable: Boolean(u.phone),
      copyValue: u.phone ? u.phone.replace(/\D/g, "") : undefined,
      isMonospace: true,
    },
  ];

  // Account & System rows
  const accountRows: ProfileRow[] = [
    {
      label: "Account Status",
      value: (clean(u.status) || "active").toUpperCase(),
      badge: {
        label: (clean(u.status) || "active").toUpperCase(),
        variant: u.status === "inactive" ? "warning" : "success",
      },
    },
    {
      label: "System Role",
      value: (clean(u.role) || "operator").replace(/_/g, " ").toUpperCase(),
    },
    {
      label: "Member Since",
      value: u.created_at ? formatDate(u.created_at) : "Not Recorded",
    },
    {
      label: "Last Profile Update",
      value: u.updated_at ? formatDate(u.updated_at) : "Not Recorded",
    },
  ];

  const sections: ProfileSection[] = [
    {
      title: "Work & Operations",
      iconName: "briefcase",
      rows: workRows,
    },
    {
      title: "Compensation & Payroll",
      iconName: "credit-card",
      rows: compRows,
    },
    {
      title: "Banking Details",
      iconName: "building",
      rows: bankRows,
    },
    {
      title: "Identity & Statutory",
      iconName: "shield",
      rows: identityRows,
    },
    {
      title: "Residential Address",
      iconName: "map-pin",
      rows: addressRows,
    },
    {
      title: "Contact Information",
      iconName: "phone",
      rows: contactRows,
    },
    {
      title: "Account & System",
      iconName: "user",
      rows: accountRows,
    },
  ];

  return {
    name: u.full_name || "",
    role: u.role || "",
    status: u.status || "active",
    email: u.email || "",
    shiftTimingDisplay: shiftDisplay,
    joinedDateDisplay: u.doj ? formatDate(u.doj) : u.created_at ? formatDate(u.created_at) : null,
    sections,
  };
}
