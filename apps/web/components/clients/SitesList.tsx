"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import { Button, Badge, useToast, Modal } from "@/components/ui";
import { SiteModal } from "./SiteModal";
import type { ClientSite } from "@/lib/data/clients/client-sites";
import { deactivateClientSite } from "@/app/actions/client-sites";
import type { AddressState } from "./AddressFields";

interface SitesListProps {
  sites: ClientSite[];
  clientId: string;
  states: AddressState[];
  currentUserRole: string;
}

export function SitesList({ sites, clientId, states, currentUserRole }: SitesListProps) {
  const { toast } = useToast();
  
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null);
  
  const [siteToDeactivate, setSiteToDeactivate] = useState<ClientSite | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canEdit = ["super_admin", "admin", "manager"].includes(currentUserRole);

  const handleOpenAdd = () => {
    setSelectedSite(null);
    setIsSiteModalOpen(true);
  };

  const handleOpenEdit = (site: ClientSite) => {
    setSelectedSite(site);
    setIsSiteModalOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!siteToDeactivate) return;
    setIsDeactivating(true);
    const res = await deactivateClientSite(siteToDeactivate.id, clientId);
    setIsDeactivating(false);

    if (res.error) {
      toast("error", res.error);
    } else {
      toast("success", "Site deactivated successfully");
      setSiteToDeactivate(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-ink)]">Client Sites</h2>
          <p className="text-sm text-[var(--color-mute)]">Manage operational sites for this client.</p>
        </div>
        {canEdit && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenAdd}>
            Add Site
          </Button>
        )}
      </div>

      {/* List / Empty State */}
      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-[var(--color-hairline)] rounded-xl bg-[var(--color-canvas)]">
          <div className="bg-[var(--color-hairline-soft-surface)] p-3 rounded-full mb-3">
            <MapPin size={24} className="text-[var(--color-mute)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">No sites found</h3>
          <p className="text-xs text-[var(--color-mute)] mt-1 mb-4 text-center max-w-sm">
            This client doesn't have any registered sites yet. Add a site to start assigning machines.
          </p>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={handleOpenAdd}>
              Add First Site
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--color-canvas-elevated)] border-b border-[var(--color-hairline)] text-[var(--color-mute)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Site Code</th>
                  <th className="px-4 py-3 font-semibold">Site Name</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canEdit && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{site.site_code}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--color-ink)]">{site.site_name}</td>
                    <td className="px-4 py-3 text-[var(--color-mute)] truncate max-w-[250px]">
                      {site.city}, {site.state_name} - {site.pincode}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={site.status === "active" ? "success" : "default"}>
                        {site.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(site)}
                            className="p-1.5 text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] rounded-md transition-colors"
                            title="Edit Site"
                          >
                            <Edit2 size={14} />
                          </button>
                          {site.status === "active" && (
                            <button
                              onClick={() => setSiteToDeactivate(site)}
                              className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                              title="Deactivate Site"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-[var(--color-hairline)]">
            {sites.map((site) => (
              <div key={site.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold bg-[var(--color-hairline-soft-surface)] px-1.5 py-0.5 rounded border border-[var(--color-hairline)]">
                        {site.site_code}
                      </span>
                      <Badge variant={site.status === "active" ? "success" : "default"}>
                        {site.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-[var(--color-ink)]">{site.site_name}</h4>
                  </div>
                </div>
                
                <div className="text-sm text-[var(--color-mute)] flex items-start gap-2">
                  <MapPin size={16} className="shrink-0 mt-0.5" />
                  <span>
                    {site.street}, {site.city}, {site.district}, {site.state_name} - {site.pincode}
                  </span>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-hairline)]">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleOpenEdit(site)}>
                      Edit
                    </Button>
                    {site.status === "active" && (
                      <Button variant="danger" size="sm" className="flex-1" onClick={() => setSiteToDeactivate(site)}>
                        Deactivate
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <SiteModal
        isOpen={isSiteModalOpen}
        onClose={() => setIsSiteModalOpen(false)}
        clientId={clientId}
        site={selectedSite}
        states={states}
      />

      <Modal
        open={Boolean(siteToDeactivate)}
        onClose={() => setSiteToDeactivate(null)}
        title="Deactivate Site"
        description={`Are you sure you want to deactivate ${siteToDeactivate?.site_name}?`}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setSiteToDeactivate(null)} disabled={isDeactivating}>
              Cancel
            </Button>
            <Button variant="danger" loading={isDeactivating} onClick={confirmDeactivate}>
              Deactivate
            </Button>
          </div>
        }
      >
        <div className="text-sm text-[var(--color-mute)]">
          Deactivating a site will hide it from active dropdowns. You cannot deactivate a site if it still has active machines assigned to it.
        </div>
      </Modal>
    </div>
  );
}
