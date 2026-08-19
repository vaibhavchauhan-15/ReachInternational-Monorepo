import * as XLSX from "xlsx";

export function getSampleExcelTemplate(): Blob {
  const headers = [
    "Machine Name",
    "Model",
    "Customer Name",
    "Customer Mobile",
    "Customer Email",
    "City",
    "State",
    "Customer Address",
    "Assigned Engineer",
    "Service Interval Days",
    "Notes",
  ];

  const sampleRows = [
    [
      "Industrial Hydraulic Press 50T",
      "HP-50-2024",
      "Apex Manufacturing Solutions",
      "9876543210",
      "contact@apexindustrial.com",
      "Mumbai",
      "Maharashtra",
      "Plot 42, MIDC Industrial Area, Phase II",
      "rajesh.engineer@example.com",
      "90",
      "Special maintenance instructions apply",
    ],
    [
      "CNC Milling Machine VMC 850",
      "VMC-850-X",
      "TechFab Industries",
      "9876543211",
      "info@techfab.com",
      "Pune",
      "Maharashtra",
      "Survey 123, Chakan Industrial Zone",
      "rajesh.engineer@example.com",
      "60",
      "",
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 30 }, // Machine Name
    { wch: 20 }, // Model
    { wch: 30 }, // Customer Name
    { wch: 18 }, // Mobile
    { wch: 30 }, // Email
    { wch: 15 }, // City
    { wch: 15 }, // State
    { wch: 40 }, // Address
    { wch: 25 }, // Engineer
    { wch: 20 }, // Interval
    { wch: 40 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Machines");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}