import { maskAadhaar, formatDate } from "./format.ts";
import type { User } from "@/lib/types/database";

export interface ProfileRow {
  label: string;
  value: string;
}

export interface ProfileSection {
  title: string;
  rows: ProfileRow[];
}

export interface ProfileViewModel {
  name: string;
  role: string;
  status: string;
  email: string;
  sections: ProfileSection[];
}

/**
 * Builds a clean, sanitized view model for the /profile page.
 * Strips empty optional fields so they don't appear in the UI.
 * Masks Aadhaar before it touches any presentation component.
 */
export function toProfileView(u: (Partial<User> & Record<string, any>) | null | undefined): ProfileViewModel {
  if (!u) {
    return {
      name: "",
      role: "",
      status: "",
      email: "",
      sections: [],
    };
  }

  const rows = (r: [string, string | null | undefined][]): ProfileRow[] =>
    r
      .filter(([, v]) => v != null && typeof v === "string" ? v.trim() !== "" && v.trim() !== "—" : v != null)
      .map(([label, value]) => ({ label, value: String(value).trim() }));

  const supervisorName =
    u.supervisor?.full_name || u.supervisor_name || null;
  const locationName =
    u.working_location?.name || u.working_location_name || null;

  return {
    name: u.full_name || "",
    role: u.role || "",
    status: u.status || "active",
    email: u.email || "",
    sections: [
      {
        title: "Contact",
        rows: rows([
          ["Email", u.email],
          ["Mobile", u.phone ? (u.phone.startsWith("+") ? u.phone : `+91 ${u.phone}`) : null],
        ]),
      },
      {
        title: "Work",
        rows: rows([
          ["Shift", u.shift_time],
          ["Supervisor", supervisorName],
          ["Working location", locationName],
        ]),
      },
      {
        title: "Address",
        rows: rows([
          ["Street", u.address],
          ["City / Town", u.city],
          ["District", u.district],
          ["State", u.state],
        ]),
      },
      {
        title: "Identity",
        rows: rows([
          ["Aadhaar", u.aadhaar_number ? maskAadhaar(u.aadhaar_number) : null],
          ["Driving licence", u.license_number],
        ]),
      },
      {
        title: "Account",
        rows: rows([
          ["Status", u.status],
          ["Joined", u.created_at ? formatDate(u.created_at) : null],
        ]),
      },
    ].filter((s) => s.rows.length > 0),
  };
}
