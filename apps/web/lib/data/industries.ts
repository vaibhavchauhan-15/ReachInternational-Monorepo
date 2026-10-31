// Verified Reach International Industry Application Data
// Pure TypeScript module usable in both Server Components and Client Components

export interface PrimaryIndustry {
  id: string;
  href?: string;
  label: string;
  eyebrow: string;
  tag: string;
  desc: string;
  image: string;
  stats: string;
  equipment: string[];
  brands: string[];
}

export const primaryIndustries: PrimaryIndustry[] = [
  {
    id: "construction",
    label: "Construction & High-Rise",
    eyebrow: "CIVIL & ARCHITECTURE",
    tag: "Commercial & Residential",
    desc: "High-elevation articulated boom lifts and rough-terrain scissors for structural glazing, steel erection, facade engineering, and landmark towers.",
    image: "/images/industry_construction_card.jpg",
    stats: "Up to 48m • 4WD Gradeability",
    equipment: ["Articulated Booms", "Telescopic Booms", "RT Scissor Lifts"],
    brands: ["JCB", "JLG", "Genie"],
  },
  {
    id: "manufacturing",
    label: "Manufacturing & Plants",
    eyebrow: "PRECISION ENGINEERING",
    tag: "Automotive & Heavy Industry",
    desc: "Zero-emission electric lifts and compact reach solutions tailored for automotive assembly lines, robotic cell installations, and heavy plant retrofits.",
    image: "/images/industry_manufacturing_card.jpg",
    stats: "Zero Emissions • Non-Marking",
    equipment: ["Electric Scissors", "Narrow Booms", "Electric Forklifts"],
    brands: ["Toyota", "JCB", "BYD"],
  },
  {
    id: "aviation",
    label: "Aviation & Aerospace",
    eyebrow: "AIRFIELD & HANGARS",
    tag: "Commercial & Defense Hangars",
    desc: "Precision telescopic platforms with protective bumper kits for fuselage inspection, tailplane maintenance, jet engine overhauls, and avionics servicing.",
    image: "/images/industry_aviation_card.jpg",
    stats: "Precision Control • Zero Jolt",
    equipment: ["Telescopic Booms", "Vertical Masts", "Spider Lifts"],
    brands: ["JLG", "Genie", "Reach"],
  },
  {
    id: "warehousing-logistics",
    label: "Warehousing & Logistics",
    eyebrow: "SUPPLY CHAIN & FULFILLMENT",
    tag: "High-Velocity Logistics",
    desc: "High-lift reach trucks, order pickers, and electric counterbalance forklifts optimized for dense vertical racking bays and continuous 24/7 turnaround.",
    image: "/images/industry_warehousing_card.jpg",
    stats: "Up to 12.5m • AC Drive Tech",
    equipment: ["Reach Trucks", "Electric Forklifts", "Order Pickers"],
    brands: ["Toyota", "BYD", "Hyundai"],
  },
  {
    id: "infrastructure",
    label: "Infrastructure & Metro Rail",
    eyebrow: "TRANSIT & MEGA-CIVILS",
    tag: "National Transit Corridors",
    desc: "Certified heavy all-terrain lifts for metro viaduct inspection, bridge pier casting, flyover erection, and international airport terminal expansion.",
    image: "/images/industry_infrastructure_card.jpg",
    stats: "Heavy Basket • All-Terrain",
    equipment: ["Articulated 4x4 Booms", "Telehandlers", "Diesel Scissors"],
    brands: ["JCB", "JLG", "Hyundai"],
  },
  {
    id: "oil-gas",
    label: "Oil, Gas & Petrochemicals",
    eyebrow: "HAZARDOUS PROCESS & ENERGY",
    tag: "Refineries & Offshore Terminals",
    desc: "Spark-arrestor equipped, Chalwyn-valve protected lifts engineered for scheduled refinery turnarounds, chemical storage maintenance, and offshore yard works.",
    image: "/images/industry_oil_gas_card.jpg",
    stats: "Zone-Certified • Spark Arrested",
    equipment: ["Articulated Booms", "Diesel Scissors", "Rough Terrain Telehandlers"],
    brands: ["JLG", "Genie", "JCB"],
  },
];
