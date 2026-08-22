"use client";

import React from "react";
import { ReachInternationalLogo } from "@/components/branding/ReachInternationalLogo";
import type { PurchaseOrder, PurchaseOrderItem } from "@/lib/types/database";

import { formatDate } from "@reachinternational/utils";

interface PrintablePurchaseOrderProps {
  po: PurchaseOrder & { items?: PurchaseOrderItem[] };
}

// Convert numbers to Indian Rupees in words format
function numberToWords(num: number): string {
  if (!num) return "Zero Rupees Only";
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty ", "Thirty ", "Forty ", "Fifty ", "Sixty ", "Seventy ", "Eighty ", "Ninety "];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + a[n % 10];
    if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 !== 0 ? "and " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 !== 0 ? inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + "Lakh " + (n % 100000 !== 0 ? inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + "Crore " + (n % 10000000 !== 0 ? inWords(n % 10000000) : "");
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = inWords(rupees) + "Rupees";
  if (paise > 0) {
    result += " and " + inWords(paise) + "Paise";
  }
  return result + " Only";
}

export function PrintablePurchaseOrder({ po }: PrintablePurchaseOrderProps) {
  const items = po.items || [];
  const grandTotal = po.grand_total || po.amount || 0;

  return (
    <div
      id="printable-po-document"
      className="bg-white text-black p-8 rounded-xl border border-neutral-300 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] min-h-[297mm] mx-auto"
    >
      <div className="flex flex-col gap-4">
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-4">
          <div className="flex flex-col gap-2">
            <ReachInternationalLogo variant="full" />
            <div className="text-[11px] text-neutral-700 leading-tight mt-1">
              Plot No.21, Palam Matiala Road, Opp Sec-5, Dwarka, New Delhi - 110 059<br />
              <strong>GST No:</strong> 07AALFR3906M1ZS | <strong>Contact:</strong> 011-23736256<br />
              <strong>Email:</strong> info@reachinternational.co.in
            </div>
          </div>
          <div className="text-right text-xs space-y-1">
            <h2 className="text-xl font-black uppercase text-neutral-900 tracking-wider">PURCHASE ORDER</h2>
            <div className="font-mono font-bold text-blue-700 text-sm">{po.po_number}</div>
            <div className="text-neutral-700">Date: <strong>{formatDate(po.created_at)}</strong></div>
            <div className="text-neutral-600">Created By: <strong>{po.requested_by || "Store Dept"}</strong></div>
            <div className="inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 rounded mt-1">
              {po.status.replace("_", " ")}
            </div>
          </div>
        </div>

        {/* Addresses Grid */}
        <div className="grid grid-cols-2 gap-4 text-[11px]">
          {/* Vendor / Issued To Address */}
          <div className="border border-neutral-300 rounded-lg p-3 bg-neutral-50/50 flex flex-col justify-between">
            <div>
              <span className="font-extrabold text-xs uppercase tracking-wider text-blue-900 block mb-1">
                Issued To (Supplier Billing Address):
              </span>
              <div className="font-bold text-neutral-900 text-sm mb-1">{po.vendor_name}</div>
              <div className="text-neutral-700 whitespace-pre-line leading-snug">
                {po.billing_address || "Supplier Address details registered in Vendor Master."}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-neutral-200 text-[10px] text-neutral-600 space-y-0.5">
              <div><strong>GST No:</strong> {po.vendor_gstin || "24BWKPG2421C1Z6"}</div>
              <div><strong>Contact Person:</strong> {po.contact_person || "Sales Representative"}</div>
              <div><strong>Phone:</strong> {po.contact_phone || "+91 9714463666"}</div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="border border-neutral-300 rounded-lg p-3 bg-neutral-50/50 flex flex-col justify-between">
            <div>
              <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-900 block mb-1">
                Shipping / Delivery Address:
              </span>
              <div className="font-bold text-neutral-900 text-sm mb-1">Reach International</div>
              <div className="text-neutral-700 whitespace-pre-line leading-snug">
                {po.shipping_address || "REACH INTERNATIONAL SITE WAREHOUSE, DWARKA SEC-5, NEW DELHI"}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-neutral-200 text-[10px] text-neutral-600 space-y-0.5">
              <div><strong>Contact Person:</strong> Store Manager / Site Incharge</div>
              <div><strong>Payment Terms:</strong> {po.payment_terms || "30 Days Net"}</div>
              <div><strong>Delivery Terms:</strong> {po.delivery_terms || "Door Delivery"}</div>
            </div>
          </div>
        </div>

        {/* Product Items Table */}
        <table className="w-full text-left text-[11px] border border-neutral-900 border-collapse">
          <thead>
            <tr className="bg-neutral-900 text-white font-bold text-[10px] uppercase">
              <th className="p-2 border border-neutral-800 w-10 text-center">S.N</th>
              <th className="p-2 border border-neutral-800">Product Detail / Description</th>
              <th className="p-2 border border-neutral-800 w-16 text-center">Qty</th>
              <th className="p-2 border border-neutral-800 w-16 text-center">Curr</th>
              <th className="p-2 border border-neutral-800 text-right w-24">Unit Price</th>
              <th className="p-2 border border-neutral-800 text-right w-16">Disc %</th>
              <th className="p-2 border border-neutral-800 text-right w-16">GST %</th>
              <th className="p-2 border border-neutral-800 text-right w-24">GST Amt</th>
              <th className="p-2 border border-neutral-800 text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-300">
            {items.length > 0 ? (
              items.map((item, idx) => (
                <tr key={item.id || idx} className="bg-white">
                  <td className="p-2 border border-neutral-300 text-center font-bold">{idx + 1}</td>
                  <td className="p-2 border border-neutral-300">
                    <div className="font-bold text-neutral-900">{item.part_number}</div>
                    <div className="text-neutral-600 text-[10px]">{item.product_description}</div>
                  </td>
                  <td className="p-2 border border-neutral-300 text-center font-mono font-bold">{item.quantity}</td>
                  <td className="p-2 border border-neutral-300 text-center text-neutral-600">INR</td>
                  <td className="p-2 border border-neutral-300 text-right font-mono">₹{Number(item.unit_price).toLocaleString("en-IN")}</td>
                  <td className="p-2 border border-neutral-300 text-right font-mono">{item.discount_percent}%</td>
                  <td className="p-2 border border-neutral-300 text-right font-mono">{item.gst_percent}%</td>
                  <td className="p-2 border border-neutral-300 text-right font-mono">₹{Number(item.gst_amount).toLocaleString("en-IN")}</td>
                  <td className="p-2 border border-neutral-300 text-right font-mono font-bold text-neutral-900">
                    ₹{Number(item.total_amount).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="bg-white">
                <td className="p-2 border border-neutral-300 text-center">1</td>
                <td className="p-2 border border-neutral-300 font-bold">Standard Maintenance & Spare Parts Supply</td>
                <td className="p-2 border border-neutral-300 text-center font-mono font-bold">1</td>
                <td className="p-2 border border-neutral-300 text-center">INR</td>
                <td className="p-2 border border-neutral-300 text-right font-mono">₹{Number(po.amount || 0).toLocaleString("en-IN")}</td>
                <td className="p-2 border border-neutral-300 text-right font-mono">0%</td>
                <td className="p-2 border border-neutral-300 text-right font-mono">18%</td>
                <td className="p-2 border border-neutral-300 text-right font-mono">₹{(Number(po.amount || 0) * 0.18).toLocaleString("en-IN")}</td>
                <td className="p-2 border border-neutral-300 text-right font-mono font-bold">
                  ₹{Number(po.amount || 0).toLocaleString("en-IN")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals & Rupees in Words */}
        <div className="flex flex-col gap-2 border border-neutral-900 p-3 bg-neutral-50">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-700 uppercase">Amount In Words:</span>
            <span className="font-extrabold text-neutral-900 italic font-serif text-sm">
              {numberToWords(grandTotal)}
            </span>
          </div>
          <div className="flex justify-end gap-6 pt-2 border-t border-neutral-300 text-xs font-mono">
            <div>Subtotal: <strong>₹{Number(po.subtotal || grandTotal * 0.82).toLocaleString("en-IN")}</strong></div>
            <div>Tax (GST): <strong>₹{Number(po.tax_amount || grandTotal * 0.18).toLocaleString("en-IN")}</strong></div>
            <div className="text-sm font-black text-blue-900">Grand Total: ₹{Number(grandTotal).toLocaleString("en-IN")}</div>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="border border-neutral-300 p-3 rounded-lg bg-white text-[10px] space-y-1">
          <div className="font-bold uppercase text-neutral-900 text-xs mb-1">Terms and Conditions:</div>
          <ol className="list-decimal list-inside space-y-0.5 text-neutral-700 font-medium">
            <li>The goods supplied should strictly confirm to the specifications/brand indicated on the purchase order.</li>
            <li>Material acceptance is subject to inspection and approval at the time of delivery at our warehouse.</li>
            <li>Goods found according to specifications etc. will be rejected at supplier&apos;s risk and cost.</li>
          </ol>
        </div>
      </div>

      {/* Footer Signatures */}
      <div className="grid grid-cols-2 gap-8 pt-8 border-t border-neutral-300 text-center text-[10px] text-neutral-600 mt-6">
        <div className="flex flex-col items-center">
          <div className="w-36 border-b border-neutral-400 mb-1 h-8 flex items-end justify-center font-serif text-neutral-800 text-xs italic font-bold">
            {po.requested_by || "Store Officer"}
          </div>
          <span className="font-bold text-neutral-900">Prepared & Verified By</span>
          <span>(Store Manager)</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-36 border-b border-neutral-400 mb-1 h-8 flex items-end justify-center font-serif text-neutral-800 text-xs italic font-bold">
            REACH INTERNATIONAL
          </div>
          <span className="font-bold text-neutral-900">Authorized Signatory</span>
          <span>(Reach International Purchase Dept)</span>
        </div>
      </div>
    </div>
  );
}
