"use client";

import React, { memo } from "react";
import { AnimatedPlus, AnimatedMapPin } from "@/components/ui/animated-icons";
import { PageHeader, Button, ExportDropdown } from "@/components/ui";

export interface ClientsHeaderProps {
  canManageClients: boolean;
  totalClients?: number;
  isExporting?: boolean;
  onOpenAddModal: () => void;
  onOpenAddSiteModal?: () => void;
  onOpenExportModal?: () => void;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

export const ClientsHeader = memo(function ClientsHeader({
  canManageClients,
  totalClients,
  isExporting = false,
  onOpenAddModal,
  onOpenAddSiteModal,
  onOpenExportModal,
  onExportExcel = onOpenExportModal || (() => {}),
  onExportCSV = onOpenExportModal || (() => {}),
  onExportPDF = () => {
    if (typeof window !== "undefined") window.print();
  },
}: ClientsHeaderProps) {
  return (
    <PageHeader
      title="Client Directory"
      breadcrumbs={[{ label: "Clients" }]}
      actions={
        <div className="flex items-center gap-2">
          <ExportDropdown
            loading={isExporting}
            onExportExcel={onExportExcel}
            onExportCSV={onExportCSV}
            onExportPDF={onExportPDF}
            align="right"
          />

          {canManageClients && (
            <>
              {onOpenAddSiteModal && (
                <Button
                  variant="secondary"
                  icon={<AnimatedMapPin size={15} className="text-emerald-600" />}
                  responsive
                  onClick={() => onOpenAddSiteModal?.()}
                  className="h-9 px-3.5 sm:px-4 text-xs font-semibold whitespace-nowrap"
                >
                  Add Site
                </Button>
              )}
              <Button
                variant="primary"
                icon={<AnimatedPlus size={15} />}
                responsive
                onClick={onOpenAddModal}
                className="h-9 px-3.5 sm:px-4 text-xs font-semibold whitespace-nowrap"
              >
                Add Client
              </Button>
            </>
          )}
        </div>
      }
    />
  );
});
