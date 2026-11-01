export interface IndianState {
  code: string;
  name: string;
  gst_state_code: string;
}

export const INDIAN_STATES: readonly IndianState[] = [
  { code: "JK", name: "Jammu and Kashmir", gst_state_code: "01" },
  { code: "HP", name: "Himachal Pradesh", gst_state_code: "02" },
  { code: "PB", name: "Punjab", gst_state_code: "03" },
  { code: "CH", name: "Chandigarh", gst_state_code: "04" },
  { code: "UK", name: "Uttarakhand", gst_state_code: "05" },
  { code: "HR", name: "Haryana", gst_state_code: "06" },
  { code: "DL", name: "Delhi", gst_state_code: "07" },
  { code: "RJ", name: "Rajasthan", gst_state_code: "08" },
  { code: "UP", name: "Uttar Pradesh", gst_state_code: "09" },
  { code: "BR", name: "Bihar", gst_state_code: "10" },
  { code: "SK", name: "Sikkim", gst_state_code: "11" },
  { code: "AR", name: "Arunachal Pradesh", gst_state_code: "12" },
  { code: "NL", name: "Nagaland", gst_state_code: "13" },
  { code: "MN", name: "Manipur", gst_state_code: "14" },
  { code: "MZ", name: "Mizoram", gst_state_code: "15" },
  { code: "TR", name: "Tripura", gst_state_code: "16" },
  { code: "ML", name: "Meghalaya", gst_state_code: "17" },
  { code: "AS", name: "Assam", gst_state_code: "18" },
  { code: "WB", name: "West Bengal", gst_state_code: "19" },
  { code: "JH", name: "Jharkhand", gst_state_code: "20" },
  { code: "OR", name: "Odisha", gst_state_code: "21" },
  { code: "CT", name: "Chhattisgarh", gst_state_code: "22" },
  { code: "MP", name: "Madhya Pradesh", gst_state_code: "23" },
  { code: "GJ", name: "Gujarat", gst_state_code: "24" },
  { code: "MH", name: "Maharashtra", gst_state_code: "27" },
  { code: "AP", name: "Andhra Pradesh", gst_state_code: "28" },
  { code: "KA", name: "Karnataka", gst_state_code: "29" },
  { code: "GA", name: "Goa", gst_state_code: "30" },
  { code: "LD", name: "Lakshadweep", gst_state_code: "31" },
  { code: "KL", name: "Kerala", gst_state_code: "32" },
  { code: "TN", name: "Tamil Nadu", gst_state_code: "33" },
  { code: "PY", name: "Puducherry", gst_state_code: "34" },
  { code: "AN", name: "Andaman and Nicobar Islands", gst_state_code: "35" },
  { code: "TG", name: "Telangana", gst_state_code: "36" },
  { code: "LA", name: "Ladakh", gst_state_code: "37" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu", gst_state_code: "38" },
] as const;

export function getStateByCode(code?: string | null): IndianState | undefined {
  if (!code) return undefined;
  return INDIAN_STATES.find((s) => s.code.toUpperCase() === code.toUpperCase());
}

export function getStateByName(name?: string | null): IndianState | undefined {
  if (!name) return undefined;
  return INDIAN_STATES.find((s) => s.name.toLowerCase() === name.toLowerCase());
}
