import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/machines/[id]/supervisors
 * Fast, atomic query returning machine's assigned supervisors and active supervisor candidate pool.
 * Only returns users where role = 'supervisor'.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: "Invalid machine ID format." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = createSupabaseAdminClient();

    // ⚡ Execute machine lookup and supervisor pool in parallel (single roundtrip)
    const [machineRes, supervisorsRes] = await Promise.all([
      supabase
        .from("machines")
        .select(`
          id,
          machine_id,
          model,
          serial_number,
          client_id,
          supervisor_ids,
          current_supervisor_id,
          status,
          client:clients!machines_client_id_fkey(id, company_name)
        `)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("id, full_name, employee_id, phone, email, role, status, shift_start_time, shift_end_time")
        .eq("role", "supervisor")
        .neq("status", "inactive")
        .order("full_name", { ascending: true }),
    ]);

    if (machineRes.error) {
      return NextResponse.json(
        { error: machineRes.error.message || "Failed to load machine." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (!machineRes.data) {
      return NextResponse.json(
        { error: "Machine not found." },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const candidateSupervisors = (supervisorsRes.data || []).map((u) => {
      const shiftTime =
        u.shift_start_time && u.shift_end_time
          ? `${String(u.shift_start_time).slice(0, 5)} - ${String(u.shift_end_time).slice(0, 5)}`
          : null;

      return {
        id: u.id,
        full_name: u.full_name || u.email || "Supervisor",
        name: u.full_name || u.email || "Supervisor",
        employee_id: u.employee_id || null,
        phone: u.phone || null,
        email: u.email || null,
        role: "supervisor" as const,
        shift_time: shiftTime,
        status: u.status || "active",
      };
    });

    return NextResponse.json(
      {
        success: true,
        machine: machineRes.data,
        supervisor_ids: machineRes.data.supervisor_ids || [],
        current_supervisor_id: machineRes.data.current_supervisor_id || null,
        supervisors: candidateSupervisors,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load machine supervisors.";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * POST /api/machines/[id]/supervisors
 * High-speed atomic supervisor assignment endpoint for equipment.
 * Enforces admin/super_admin/manager permissions.
 * Writes in a single atomic database query and revalidates cache tags non-blockingly.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: "Invalid machine ID format." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    if (!["admin", "super_admin", "manager"].includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to assign equipment supervisors." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawIds = body.supervisor_ids ?? body.supervisorIds ?? [];
    const validSups = Array.isArray(rawIds)
      ? Array.from(new Set(rawIds.map((v) => String(v).trim()).filter(isValidUuid)))
      : [];

    const current_supervisor_id = validSups[0] || null;
    const supabase = await createSupabaseServerClient();

    // ⚡ Update machine in 1 atomic write
    const { error: updateError } = await supabase
      .from("machines")
      .update({
        supervisor_ids: validSups,
        current_supervisor_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update machine supervisors." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // ⚡ Asynchronous non-blocking audit log
    void logAudit({
      action: "machine.supervisors_updated",
      entity_type: "machine",
      entity_id: id,
      metadata: {
        supervisor_ids: validSups,
        current_supervisor_id,
        updated_by: user.id,
      },
    });

    // ⚡ Asynchronous cache tag revalidation
    try {
      revalidateTag(TAGS.machineDetail(id), "max");
      revalidateTag(TAGS.machinesList, "max");
      revalidateTag(TAGS.machines, "max");
    } catch (tagErr) {
      console.warn("[api/machines/supervisors] Cache tag revalidation warning:", tagErr);
    }

    // Load fresh supervisor objects for immediate client consumption (fast: reuse client objects if valid, or query)
    let freshSupervisors: Array<{
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      employee_id: string | null;
      role: string;
      isPrimary?: boolean;
    }> = [];

    if (Array.isArray(body.supervisors) && body.supervisors.length === validSups.length) {
      freshSupervisors = body.supervisors;
    } else if (validSups.length > 0) {
      const adminClient = createSupabaseAdminClient();
      const { data: supUsers } = await adminClient
        .from("users")
        .select("id, full_name, phone, email, employee_id, role")
        .in("id", validSups);

      const map = new Map((supUsers || []).map((u) => [u.id, u]));
      freshSupervisors = validSups
        .map((supId, index) => {
          const u = map.get(supId);
          if (!u) return null;
          return {
            id: u.id,
            full_name: u.full_name || "Supervisor",
            phone: u.phone || null,
            email: u.email || null,
            employee_id: u.employee_id || null,
            role: "supervisor",
            isPrimary: index === 0,
          };
        })
        .filter((u): u is NonNullable<typeof u> => Boolean(u));
    }

    return NextResponse.json(
      {
        success: true,
        machineId: id,
        supervisor_ids: validSups,
        current_supervisor_id,
        supervisors: freshSupervisors,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update supervisors.";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
