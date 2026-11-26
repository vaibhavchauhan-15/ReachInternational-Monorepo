import { NextRequest, NextResponse } from "next/server";
import {
  MACHINE_CAPABILITIES,
  hasMachineCapability,
} from "@reachinternational/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildLogsheetImportTemplate } from "@/lib/server/logsheet-import/template";
import { LOGSHEET_IMPORT_TEMPLATE_VERSION } from "@reachinternational/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/operations/logsheet-import/template
 *
 * Downloads the standardized machine logsheet import workbook
 * (Logsheet Data + Instructions + Data Dictionary), generated from the
 * canonical column model.
 *
 * Admin-only (super_admin / admin). Dual authentication: Bearer JWT for the
 * native app, cookie session for the web app. The caller's REAL role is read
 * from the database — client-supplied claims are never trusted.
 */
export async function GET(req: NextRequest) {
  const noStore = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  const adminSupabase = createSupabaseAdminClient();
  let authUser: { id: string } | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const { data, error } = await adminSupabase.auth.getUser(token);
    if (!error && data?.user) authUser = data.user;
  }
  if (!authUser) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) authUser = data.user;
    } catch {
      // handled below
    }
  }
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  }

  const { data: userRow } = await adminSupabase
    .from("users")
    .select("role, status")
    .eq("id", authUser.id)
    .maybeSingle();

  const role = (userRow?.role || "") as string;
  if (!userRow || userRow.status !== "active" || !hasMachineCapability(role, MACHINE_CAPABILITIES.LOGS_IMPORT)) {
    return NextResponse.json(
      { error: "Forbidden: your account role is not authorized to import machine logsheets." },
      { status: 403, headers: noStore }
    );
  }

  try {
    const buffer = await buildLogsheetImportTemplate();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reach-machine-logsheet-import-template-v${LOGSHEET_IMPORT_TEMPLATE_VERSION}.xlsx"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate the import template." },
      { status: 500, headers: noStore }
    );
  }
}
