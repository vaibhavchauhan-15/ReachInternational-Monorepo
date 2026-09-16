"use client";

import { useState, memo } from "react";
import {
  AnimatedChevronRight,
  AnimatedCopy,
  AnimatedCheck,
} from "@/components/ui/animated-icons";
import { Phone, Edit2, Trash2, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Badge, useToast } from "@/components/ui";
import { Highlight } from "@/components/ui/Highlight";
import type { CRMClient } from "@/lib/types/database";

interface MobileClientCardProps {
  client: CRMClient;
  canManageClients: boolean;
  searchTerm?: string;
  onViewClient: (client: CRMClient) => void;
  onEditClient: (client: CRMClient) => void;
  onDeleteClient: (client: CRMClient) => void;
  onRestoreClient?: (client: CRMClient) => void;
}

export const MobileClientCard = memo(function MobileClientCard({
  client,
  canManageClients,
  searchTerm = "",
  onViewClient,
  onEditClient,
  onDeleteClient,
  onRestoreClient,
}: MobileClientCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!client.code) return;
    navigator.clipboard.writeText(client.code);
    setCopied(true);
    toast("success", `Copied Client Code: ${client.code}`);
    setTimeout(() => setCopied(false), 1800);
  };

  const isSoftDeleted = Boolean(client.deleted_at || client.status === "inactive");

  const getAccentBorder = () => {
    if (client.deleted_at) {
      return "border-l-[3px] border-l-rose-500 dark:border-l-rose-400";
    }
    if (client.status === "inactive") {
      return "border-l-[3px] border-l-amber-500 dark:border-l-amber-400";
    }
    return "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      onClick={() => onViewClient(client)}
      className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer ${getAccentBorder()}`}
    >
      {/* Top Hairline Sheen on Hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 dark:via-sky-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {client.code && (
              <button
                onClick={handleCopyCode}
                type="button"
                className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] border border-[var(--color-hairline)] text-xs font-mono font-bold uppercase text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all cursor-pointer"
                title="Click to copy Client Code"
              >
                <span>
                  <Highlight text={client.code} query={searchTerm} />
                </span>
                {copied ? (
                  <AnimatedCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AnimatedCopy size={13} className="text-[var(--color-mute)] shrink-0" />
                )}
              </button>
            )}

            <span className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate tracking-tight">
              <Highlight text={client.company_name || client.client_name || "Untitled Client"} query={searchTerm} />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-mute)] mt-1.5 font-medium">
            {client.contact_person && (
              <span className="text-[var(--color-body)]">
                Contact: <Highlight text={client.contact_person} query={searchTerm} />
              </span>
            )}
            {client.city && (
              <span className="before:content-['•'] before:mr-2 text-[var(--color-body)]">
                <Highlight text={client.city} query={searchTerm} />
              </span>
            )}
            {client.gstin && (
              <span className="font-mono text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-semibold">
                GST: <Highlight text={client.gstin} query={searchTerm} />
              </span>
            )}
            {client.pan_number && (
              <span className="font-mono text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/20 font-semibold">
                PAN: <Highlight text={client.pan_number} query={searchTerm} />
              </span>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {client.deleted_at ? (
            <Badge variant="overdue" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Soft Deleted
            </Badge>
          ) : client.status === "inactive" ? (
            <Badge variant="warning" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Inactive
            </Badge>
          ) : (
            <Badge variant="success" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Structured Key Specs Inset Well */}
      <div className="p-3 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Contact Person:</span>
            <span
              className="font-bold text-xs text-[var(--color-ink)] mt-0.5 truncate block"
              title={client.contact_person || "Unassigned"}
            >
              {client.contact_person || "—"}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Site Location:</span>
            <span
              className="font-bold text-xs text-[var(--color-ink)] mt-0.5 truncate block"
              title={client.address || client.street || client.city || "—"}
            >
              {client.city || client.address || client.street || "—"}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Phone:</span>
            {client.phone ? (
              <a
                href={`tel:${client.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono font-bold text-xs text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 mt-0.5 truncate flex items-center gap-1 transition-colors"
              >
                <Phone size={11} className="text-[var(--color-mute)] shrink-0" />
                <span className="truncate">{client.phone}</span>
              </a>
            ) : (
              <span className="text-xs text-[var(--color-mute)] italic mt-0.5 block">—</span>
            )}
          </div>
          <div>
            <span className="text-[var(--color-mute)] font-medium block">State / District:</span>
            <span
              className="font-semibold text-xs text-[var(--color-ink)] mt-0.5 truncate block"
              title={[client.district, client.state, client.pincode].filter(Boolean).join(", ")}
            >
              {[client.district, client.state].filter(Boolean).join(", ") || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {canManageClients && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClient(client);
                }}
                className="h-8 px-3 rounded-md text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Edit Client Information"
              >
                <Edit2 size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSoftDeleted && onRestoreClient) {
                    onRestoreClient(client);
                  } else {
                    onDeleteClient(client);
                  }
                }}
                className="h-8 w-8 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] active:scale-95 transition-all text-xs font-semibold flex items-center justify-center cursor-pointer shadow-2xs"
                title={isSoftDeleted ? "Restore Client" : "Delete Client"}
                aria-label={isSoftDeleted ? "Restore Client" : "Delete Client"}
              >
                {isSoftDeleted ? (
                  <RotateCcw size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Trash2 size={14} className="shrink-0" />
                )}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewClient(client);
          }}
          className="h-8 px-3 rounded-md text-xs font-bold text-[var(--color-link)] bg-sky-500/10 hover:bg-sky-500/15 active:scale-95 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
          title="View Client Details"
        >
          <span>View Details</span>
          <AnimatedChevronRight size={14} className="shrink-0" />
        </button>
      </div>
    </motion.div>
  );
});
