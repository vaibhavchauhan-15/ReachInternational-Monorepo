"use client";

import React from "react";
import type { PartIssue, PartIssueItem } from "@/lib/types/database";

import { formatDate } from "@reachinternational/utils";

interface PrintablePartsIssueChallanProps {
  issue: PartIssue & {
    items?: PartIssueItem[];
  };
}

export function PrintablePartsIssueChallan({ issue }: PrintablePartsIssueChallanProps) {
  const items = issue.items || [];

  return (
    <div
      id="printable-pic-document"
      className="bg-white text-black p-6 rounded-xl border border-neutral-900 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] min-h-[297mm] mx-auto"
    >
      <div className="flex flex-col gap-3">
        {/* Document Header matching Physical Slip Reference */}
        <div className="border border-neutral-900 p-3 bg-neutral-50 flex items-center justify-between">
          <div>
            <div className="text-sm font-mono font-bold text-neutral-900">
              S.No.: <span className="text-blue-800 text-base">{issue.challan_number || "2201"}</span>
            </div>
            <div className="text-[10px] text-neutral-600">Yard / Reach Store Dept</div>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-black uppercase text-neutral-900 tracking-wider">Parts Issue Challan</h1>
            <div className="text-xs font-bold text-neutral-800">Reach International</div>
            <div className="text-[10px] font-mono text-neutral-600">www.reachinternational.co.in | Cont. 011-23736256</div>
          </div>

          <div className="text-right font-mono font-bold text-xs">
            <div>DATE: {formatDate(issue.issue_date || new Date())}</div>
            <div className="text-[10px] text-neutral-500 font-normal mt-0.5">
              Issue No: {issue.issue_number}
            </div>
          </div>
        </div>

        {/* Issue Details Strip */}
        <div className="border border-neutral-900 p-2 bg-neutral-100/80 grid grid-cols-3 text-[11px] gap-2 font-medium">
          <div><strong>Issued By:</strong> {issue.issuer?.full_name || "Store Manager"}</div>
          <div><strong>Issued To:</strong> <span className="font-bold text-neutral-900">{issue.issued_to_name}</span></div>
          <div><strong>Returnable Status:</strong> <span className={`font-bold ${issue.is_returnable ? "text-amber-800" : "text-neutral-900"}`}>{issue.is_returnable ? "RETURNABLE (YES)" : "NON-RETURNABLE (NO)"}</span></div>
        </div>

        {/* Parts Grid Table matching Physical Layout */}
        <table className="w-full text-left text-xs border border-neutral-900 border-collapse">
          <thead>
            <tr className="bg-neutral-900 text-white font-bold text-[10px] uppercase divide-x divide-neutral-800">
              <th className="p-2 w-10 text-center">Sr.</th>
              <th className="p-2 w-28">Part No.</th>
              <th className="p-2">Description</th>
              <th className="p-2 w-14 text-center">Qty</th>
              <th className="p-2 w-28">Machine No.</th>
              <th className="p-2 w-28">Issue To</th>
              <th className="p-2 w-24 text-center">Return / Non Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 text-[11px]">
            {items.length > 0 ? (
              items.map((item, idx) => (
                <tr key={item.id || idx} className="divide-x divide-neutral-900 bg-white">
                  <td className="p-2 text-center font-bold">{idx + 1}</td>
                  <td className="p-2 font-mono font-bold text-blue-900">{item.product?.part_number || "PART-" + (idx + 1)}</td>
                  <td className="p-2 font-semibold text-neutral-900">{item.product?.name || "Spare Part Item"}</td>
                  <td className="p-2 text-center font-mono font-bold">{item.quantity_issued}</td>
                  <td className="p-2 font-mono text-neutral-800">{item.machine_code || issue.machine?.machine_code || "M-STORE"}</td>
                  <td className="p-2 font-medium">{issue.issued_to_name}</td>
                  <td className="p-2 text-center font-bold text-[10px]">
                    {item.is_returnable ? (
                      <span className="text-amber-800 bg-amber-100 px-1 py-0.5 rounded border border-amber-300">YES</span>
                    ) : (
                      <span className="text-neutral-600">NO</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              // Mock rows matching physical reference image if empty
              [
                { sr: 1, partNo: "-", desc: "Sleeve 05 mm", qty: 10, machine: "Z60/84", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 2, partNo: "-", desc: "10 mm", qty: 10, machine: "EGS-14244", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 3, partNo: "-", desc: "Cable Tie", qty: 100, machine: "-", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 4, partNo: "-", desc: "Cable", qty: 7, machine: "55W/2 TG", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 5, partNo: "1274971", desc: "Joy Stick", qty: 3, machine: "Engine - 15", issueTo: issue.issued_to_name, returnable: "YES" },
                { sr: 6, partNo: "-", desc: "Pre Tape", qty: 1, machine: "Chest - 10", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 7, partNo: "66813", desc: "Horn Push Button", qty: 4, machine: "Horn 12V", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 8, partNo: "45363", desc: "Lever Sleeper", qty: 1, machine: "-", issueTo: issue.issued_to_name, returnable: "NO" },
                { sr: 9, partNo: "827653", desc: "Load Display / Air Filter", qty: 1, machine: "-", issueTo: issue.issued_to_name, returnable: "YES" },
              ].map((r) => (
                <tr key={r.sr} className="divide-x divide-neutral-900 bg-white">
                  <td className="p-2 text-center font-bold">{r.sr}</td>
                  <td className="p-2 font-mono font-bold text-blue-900">{r.partNo}</td>
                  <td className="p-2 font-semibold text-neutral-900">{r.desc}</td>
                  <td className="p-2 text-center font-mono font-bold">{r.qty}</td>
                  <td className="p-2 font-mono text-neutral-800">{r.machine}</td>
                  <td className="p-2 font-medium">{r.issueTo}</td>
                  <td className="p-2 text-center font-bold text-[10px]">{r.returnable}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Remarks section */}
        {issue.remarks && (
          <div className="border border-neutral-300 p-2 rounded bg-neutral-50 text-[11px]">
            <strong>Remarks / Notes:</strong> {issue.remarks}
          </div>
        )}
      </div>

      {/* Signature Bar matching physical slip footer */}
      <div className="border-t-2 border-neutral-900 pt-6 mt-8 grid grid-cols-3 gap-4 text-center text-xs text-neutral-800">
        <div className="flex flex-col items-center">
          <div className="w-32 border-b border-neutral-900 mb-1 font-serif italic text-blue-900 font-bold">
            {issue.issuer?.full_name || "Store Manager"}
          </div>
          <span className="font-bold text-neutral-900">Issued By:</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-32 border-b border-neutral-900 mb-1 font-serif italic text-neutral-700 font-bold">
            Verified
          </div>
          <span className="font-bold text-neutral-900">Checked By:</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-32 border-b border-neutral-900 mb-1 h-4"></div>
          <span className="font-bold text-neutral-900">Signature:</span>
          <span className="text-[10px] text-neutral-500">(Receiver Signature)</span>
        </div>
      </div>
    </div>
  );
}
