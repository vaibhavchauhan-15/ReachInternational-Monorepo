"use server";

import { getClientsForExport } from "@/lib/data/clients";
import { requireRole } from "@/lib/dal";
import type { ClientDirectoryFilter } from "@reachinternational/utils";

export async function getClientExportDataAction(filter?: ClientDirectoryFilter) {
  await requireRole("super_admin", "admin", "manager");
  return getClientsForExport(filter);
}
