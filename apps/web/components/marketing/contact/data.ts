export interface ContactFaqItem {
  q: string;
  a: string;
}

export const CONTACT_FAQS: ContactFaqItem[] = [
  {
    q: "What are the direct contact numbers and emails for rental vs sales?",
    a: "For equipment rental, flexible leases, and operator dispatch, reach our Rental Desk on Mobile: +91 88000 40308 (mo: 8800040308) or Email: rental@reachinternational.co.in. For brand-new and certified pre-owned equipment purchases, reach our Sales Desk on Mobile: +91 98677 32204 (mo: 9867732204) or Email: sale@reachinternational.co.in.",
  },
  {
    q: "How quickly can equipment be mobilized to our job site?",
    a: "Standard aerial access platforms (boom lifts and scissor lifts) are mobilized within 24 to 48 hours across primary industrial regions including Delhi NCR, Mumbai / Navi Mumbai, Gujarat, Bengaluru, and Chennai. Urgent breakdown replacement units are prioritized with expedited transport.",
  },
  {
    q: "Does Reach International provide certified machine operators?",
    a: "Yes. Every rental package can include certified, statutory-compliant machine operators trained in high-reach safety protocols, load chart calculations, and automated HMR running logs. Unoperated (dry lease) rentals are also available for qualified site teams.",
  },
  {
    q: "Which authorized OEM partner brands do you supply?",
    a: "We are authorized fleet partners and distributors for top global heavy access and material handling manufacturers, including JLG, Genie, JCB, Toyota Material Handling, Hyundai Construction Equipment, and BYD Lithium-Iron Forklifts.",
  },
  {
    q: "What is the guaranteed response time when submitting a quotation enquiry?",
    a: "Our heavy machinery applications engineers review all form submissions and inquiries within 2 hours during business hours (Monday to Saturday, 8:00 AM – 8:00 PM IST), providing machine payload verification, working height recommendations, and comprehensive pricing proposals.",
  },
];

export interface RegionalHubItem {
  city: string;
  region: string;
  address: string;
  phone: string;
  email: string;
  capabilities: string;
}

export const REGIONAL_HUBS: RegionalHubItem[] = [
  {
    city: "Delhi NCR (Headquarters & Central Depot)",
    region: "Northern Hub",
    address: "Reach International Logistics & Fleet Facility, Delhi NCR, India",
    phone: "+91 88000 40308",
    email: "rental@reachinternational.co.in",
    capabilities: "Central yard, heavy boom lifts, boom trucks, certified operator academy",
  },
  {
    city: "Mumbai & Navi Mumbai",
    region: "Western Hub",
    address: "Industrial Corridor, Navi Mumbai / JNPT Logistics Zone, Maharashtra",
    phone: "+91 98677 32204",
    email: "sale@reachinternational.co.in",
    capabilities: "Port handling machinery, warehouse reach trucks, rough-terrain boom lifts",
  },
  {
    city: "Ahmedabad & Sanand",
    region: "Gujarat Manufacturing Hub",
    address: "Sanand Industrial Estate & GIDC Logistics Park, Gujarat",
    phone: "+91 88000 40308",
    email: "rental@reachinternational.co.in",
    capabilities: "Automotive plant maintenance platforms, indoor electric slab scissor lifts",
  },
  {
    city: "Bengaluru & Chennai",
    region: "Southern Hub",
    address: "Hosur / Sriperumbudur Industrial Corridors, Karnataka & Tamil Nadu",
    phone: "+91 98677 32204",
    email: "sale@reachinternational.co.in",
    capabilities: "Electronics cleanroom lifts, high-rack narrow-aisle warehouse machinery",
  },
];

export const CONTACT_DETAILS = {
  rental: {
    phoneDisplay: "+91 88000 40308",
    phoneRaw: "8800040308",
    phoneTel: "+918800040308",
    email: "rental@reachinternational.co.in",
  },
  sale: {
    phoneDisplay: "+91 98677 32204",
    phoneRaw: "9867732204",
    phoneTel: "+919867732204",
    email: "sale@reachinternational.co.in",
  },
};
