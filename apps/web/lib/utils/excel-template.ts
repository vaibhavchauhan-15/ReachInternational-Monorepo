import * as XLSX from "xlsx";

export function getSampleExcelTemplate(): Blob {
  const headers = [
    "Machine ID",
    "Model",
    "Manufacturer",
    "Serial Number",
    "Year of MFG",
    "Hour Meter (HMR)",
    "Service Count",
    "Status",
    "Health Status",
  ];

  const sampleRows = [
    [
      "RI-MC-0001",
      "JCB 3DX EcoXcellence",
      "JCB",
      "SN-JCB-2024-001",
      "2024",
      1250.5,
      4,
      "available",
      "active",
    ],
    [
      "RI-MC-0002",
      "CAT 320D Hydraulic Excavator",
      "Caterpillar",
      "SN-CAT-2023-992",
      "2023",
      2480.0,
      8,
      "rented",
      "active",
    ],
    [
      "", // Leave blank for auto-generated Machine ID
      "SANY SY215C Excavator",
      "SANY",
      "SN-SNY-2024-412",
      "2024",
      450.0,
      1,
      "available",
      "under_maintenance",
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 18 }, // Machine ID
    { wch: 32 }, // Model
    { wch: 20 }, // Manufacturer
    { wch: 24 }, // Serial Number
    { wch: 15 }, // Year of MFG
    { wch: 20 }, // Hour Meter (HMR)
    { wch: 15 }, // Service Count
    { wch: 15 }, // Status
    { wch: 20 }, // Health Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Machines");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}