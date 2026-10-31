"use client";

import React from "react";
import { FileText, Download, ShieldCheck } from "lucide-react";
import type { EquipmentDocument } from "@reachinternational/types";
import { cn } from "@/lib/utils";

export interface EquipmentDocumentsProps {
  documents: EquipmentDocument[];
  modelName: string;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "PDF";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function EquipmentDocuments({
  documents,
  modelName,
  className,
}: EquipmentDocumentsProps) {
  if (!documents || documents.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="documents-heading" className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3
            id="documents-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            Technical Documents &amp; Manuals
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Verified manufacturer specification sheets and brochures for {modelName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl bg-[#0284c7]/10 text-[#0284c7] flex items-center justify-center shrink-0">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {doc.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  <span className="uppercase">{doc.document_type.replace("_", " ")}</span>
                  <span>•</span>
                  <span>{formatBytes(doc.file_size_bytes)}</span>
                </div>
              </div>
            </div>

            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-[#0284c7] hover:text-white text-neutral-700 dark:text-neutral-300 transition-colors shrink-0 cursor-pointer"
              aria-label={`Download ${doc.title}`}
            >
              <span>Download</span>
              <Download className="size-3.5" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
