"use client";

import React from "react";
import type { DeliveryChallan, DeliveryChallanItem } from "@/lib/types/database";

import { formatDate } from "@reachinternational/utils";

interface PrintableDeliveryChallanProps {
  challan: DeliveryChallan & {
    from_address?: string;
    from_gstin?: string;
    to_customer_name?: string;
    to_address?: string;
    to_gstin?: string;
    approx_value?: number;
    note_declaration?: string;
    authorised_signatory?: string;
    pan_no?: string;
    items?: DeliveryChallanItem[];
  };
}

export function PrintableDeliveryChallan({ challan }: PrintableDeliveryChallanProps) {
  const items = challan.items || [];
  const totalQty = items.reduce((acc, item) => acc + (item.quantity || 0), 0) || 1;
  const approxValue = challan.approx_value || challan.amount || 40000;

  return (
    <div
      id="printable-dc-document"
      className="bg-white text-black p-8 rounded-xl border border-neutral-900 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] min-h-[297mm] mx-auto"
    >
      <div className="flex flex-col gap-3">
        {/* Header Block matching Physical Reference Image */}
        <div className="border border-neutral-900 grid grid-cols-12 divide-x divide-neutral-900">
          {/* Logo & Company Info */}
          <div className="col-span-8 p-3 flex flex-col gap-1.5">
            {/* eslint-disable-next-html-element-suppress */}
            <img
              src="/pdf-logo.png"
              alt="Reach International"
              className="h-12 w-auto object-contain self-start"
            />
            <div className="text-[10px] text-neutral-800 leading-tight">
              PLOT NO. 21, PALAM MATIALA ROAD, MADHU VIHAR, OPPOSITE SECTOR-5,<br />
              DWARKA, NEW DELHI-110059<br />
              <strong>Tel.:</strong> 011-23736256 | <strong>E-mail:</strong> reachliftingequipments@gmail.com
            </div>
          </div>

          {/* Document Title & Number */}
          <div className="col-span-4 p-3 flex flex-col justify-between bg-neutral-50 text-right">
            <div>
              <h2 className="text-base font-black uppercase text-neutral-900 tracking-wide border-b border-neutral-400 pb-1 mb-1">
                DELIVERY CHALLAN
              </h2>
              <div className="font-mono font-bold text-neutral-900 text-xs">
                Challan no: <span className="text-blue-800">{challan.challan_number || "RI/DC/0530"}</span>
              </div>
            </div>
            <div className="text-xs font-bold text-neutral-900 pt-2 border-t border-neutral-300">
              DATE: {formatDate(challan.issue_date || new Date())}
            </div>
          </div>
        </div>

        {/* TO & FROM Address Boxes matching Physical Document layout */}
        <div className="border border-neutral-900 grid grid-cols-2 divide-x divide-neutral-900 text-[11px]">
          {/* TO Customer Site */}
          <div className="p-3 flex flex-col justify-between">
            <div>
              <span className="font-bold text-neutral-900 uppercase block mb-1">TO :-</span>
              <div className="font-black text-neutral-900 uppercase text-xs">
                {challan.to_customer_name || challan.client_name || "PUSHPA INFRACON C/O GLCPL-AHC JV"}
              </div>
              <div className="text-neutral-800 uppercase font-medium mt-1 leading-snug">
                {challan.to_address || "ADD:-CONSTRUCTION OF NEW CIVIL ENCLAVE AT JAMMU AIRPORT NEAR ANIMAL HUSBANDRY DEPARTMENT, BELI CHARANA, JAMMU CANTT-180001"}
              </div>
            </div>
            <div className="mt-3 pt-1 border-t border-neutral-300 font-bold text-neutral-900">
              GSTIN:- {challan.to_gstin || "01ACEPM4629B1Z8"}
            </div>
          </div>

          {/* FROM Reach International Branch */}
          <div className="p-3 flex flex-col justify-between bg-neutral-50/50">
            <div>
              <span className="font-bold text-neutral-900 uppercase block mb-1">FROM :-</span>
              <div className="font-black text-neutral-900 uppercase text-xs">REACH INTERNATIONAL</div>
              <div className="text-neutral-800 uppercase font-medium mt-1 leading-snug">
                {challan.from_address || "PLOT NO.21, PALAM MATIALA ROAD, MADHU VIHAR, OPPOSITE SECTOR-5, DWARKA, NEW DELHI-110059"}
              </div>
            </div>
            <div className="mt-3 pt-1 border-t border-neutral-300 font-bold text-neutral-900">
              GSTIN:- {challan.from_gstin || "07AALFR3906M1ZS"}
            </div>
          </div>
        </div>

        {/* Goods Table matching reference image design */}
        <table className="w-full text-left text-xs border border-neutral-900 border-collapse">
          <thead>
            <tr className="bg-amber-400 text-neutral-900 font-black text-xs uppercase divide-x divide-neutral-900">
              <th className="p-2.5 w-16 text-center border-b border-neutral-900">S.No</th>
              <th className="p-2.5 border-b border-neutral-900">DISCRIPTION OF GOODS</th>
              <th className="p-2.5 w-24 text-center border-b border-neutral-900">QTY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {items.length > 0 ? (
              items.map((item, idx) => (
                <tr key={item.id || idx} className="divide-x divide-neutral-900 h-16">
                  <td className="p-2.5 text-center font-bold text-neutral-900">{idx + 1}</td>
                  <td className="p-2.5 uppercase font-bold text-neutral-900">
                    {item.description || item.part_number}
                    {item.machine_number && <div className="text-[10px] text-neutral-600 font-mono">For Machine: {item.machine_number}</div>}
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold text-neutral-900 text-sm">
                    {String(item.quantity).padStart(2, "0")}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="divide-x divide-neutral-900 h-24">
                <td className="p-2.5 text-center font-bold text-neutral-900">1</td>
                <td className="p-2.5 uppercase font-bold text-neutral-900 text-sm">
                  AGM BATTERY 12V
                  <div className="text-[10px] text-neutral-600 font-mono">For Machine Maintenance & Internal Operational Use</div>
                </td>
                <td className="p-2.5 text-center font-mono font-bold text-neutral-900 text-base">08</td>
              </tr>
            )}

            {/* Total Row matching physical format */}
            <tr className="divide-x divide-neutral-900 font-bold bg-neutral-100">
              <td colSpan={2} className="p-2 text-right uppercase text-xs">Total</td>
              <td className="p-2 text-center font-mono font-extrabold text-sm">
                {String(totalQty).padStart(2, "0")}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Declarations & Value Note */}
        <div className="border border-neutral-900 p-3 bg-amber-50 space-y-1 text-xs">
          <div className="font-bold text-neutral-900">
            Approx value Rs. {Number(approxValue).toLocaleString("en-IN")}/-
          </div>
          <div className="font-bold text-neutral-900 uppercase tracking-tight text-[11px]">
            NOTE: {challan.note_declaration || "This item is not for sale; it is use for in our own machine."}
          </div>
        </div>
      </div>

      {/* Signature & Bottom Details matching physical document */}
      <div className="flex flex-col gap-4 mt-8">
        <div className="flex items-end justify-between px-4 pt-8">
          <div className="text-center">
            <div className="w-40 border-b border-neutral-400 mb-1"></div>
            <span className="font-bold text-neutral-900 text-xs">Receiver Signature</span>
          </div>
          <div className="text-center flex flex-col items-center">
            <div className="w-44 h-12 border border-dashed border-neutral-400 flex items-center justify-center text-[10px] text-neutral-400 italic mb-1">
              [ Seal & Stamp ]
            </div>
            <span className="font-bold text-neutral-900 text-xs">{challan.authorised_signatory || "Authorised Signatory"}</span>
          </div>
        </div>

        {/* Bottom GSTIN & PAN Bar matching physical image footer */}
        <div className="border-t-2 border-neutral-900 pt-2 flex items-center justify-between font-mono font-bold text-xs text-neutral-900">
          <div>GSTIN:- {challan.from_gstin || "07AALFR3906M1ZS"}</div>
          <div>PAN No.:- {challan.pan_no || "AALFR3906M"}</div>
        </div>
      </div>
    </div>
  );
}
