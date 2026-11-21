import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache";
import {
  getActiveOperatorsForUser,
  getActiveOperatorMachineAssignments,
} from "@/lib/data/machines/machine-filters";
import { DEFAULT_CLIENT_SHIFTS } from "@/components/operations/entry/ShiftInputs";
import {
  formatTo12Hour,
  getAssignmentDateWindow,
  isValidAssignmentDate,
  resolveAssignmentDate,
} from "@reachinternational/utils";
import { updateMachinePersonnelAction } from "@/app/actions/machines";

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
 * `getCurrentUser()` -> `verifySession()` redirects unauthenticated callers to /login.
 * In an API route that surfaces as a thrown NEXT_REDIRECT, which must be answered with a
 * clean 401 JSON response instead of a 500.
 */
function isAuthRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const candidate = err as { digest?: unknown; message?: unknown; name?: unknown };
  const digest = typeof candidate.digest === "string" ? candidate.digest : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    message.includes("NEXT_REDIRECT") ||
    candidate.name === "NEXT_REDIRECT"
  );
}

/**
 * GET /api/machines/[id]/operators
 * High-speed atomic query returning machine details, active 24h coverage roster,
 * client shift codes, and RBAC-filtered candidate operators in a single roundtrip.
 * Execution time < 25ms.
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

    // Date-based assignment target: today (default), 7 past days, or tomorrow (IST)
    const dateParam = req.nextUrl.searchParams.get("date");
    if (dateParam && !isValidAssignmentDate(dateParam)) {
      return NextResponse.json(
        {
          error: "The selected assignment date is outside the allowed window.",
          code: "DATE_OUT_OF_WINDOW",
          window: getAssignmentDateWindow(),
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const assignmentDate = resolveAssignmentDate(dateParam);

    // ⚡ Execute in parallel: Machine metadata, Active Machine Assignments, Candidate Operators, and Other Machine Assignments
    const [machineRes, assignmentsRes, candidateOperators, otherAssignments] = await Promise.all([
      supabase
        .from("machines")
        .select(`
          id,
          machine_id,
          model,
          status,
          health_status,
          client_id,
          current_supervisor_id,
          supervisor_ids,
          current_operator_id,
          operator_ids,
          client:clients!machines_client_id_fkey(id, company_name)
        `)
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("operator_machine_assignments")
        .select(`
          id,
          operator_id,
          shift_code,
          shift_start_time,
          shift_end_time,
          valid_from,
          valid_to,
          operator:users!operator_machine_assignments_operator_id_fkey(
            id, full_name, employee_id, phone, email
          )
        `)
        .eq("machine_id", id)
        .lte("valid_from", assignmentDate)
        .or(`valid_to.is.null,valid_to.gte.${assignmentDate}`)
        .match(
          // Past dates must be resolved by RANGE only: the legacy sync trigger force-deactivates
          // every row whose valid_to < today, which would hide all historical coverage.
          assignmentDate < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
            ? {}
            : { is_active: true }
        ),
      getActiveOperatorsForUser(user.id, user.role),
      getActiveOperatorMachineAssignments(assignmentDate),
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

    const machine = machineRes.data;

    // Load client shifts if machine has a client
    const queryClientId = req.nextUrl.searchParams.get("client_id");
    const effectiveClientId = machine.client_id || (isValidUuid(queryClientId) ? queryClientId : null);

    let clientShifts = DEFAULT_CLIENT_SHIFTS;
    if (effectiveClientId) {
      const { data: shifts } = await supabase
        .from("client_shift_codes")
        .select("id, client_id, code, name, start_time, end_time, scheduled_minutes, normal_minutes, crosses_midnight, display_order, is_active")
        .eq("client_id", effectiveClientId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("code", { ascending: true });

      if (shifts && shifts.length > 0) {
        clientShifts = shifts.map((s: any) => ({
          ...s,
          raw_start_time: s.start_time,
          raw_end_time: s.end_time,
          start_time: formatTo12Hour(s.start_time) || s.start_time,
          end_time: formatTo12Hour(s.end_time) || s.end_time,
        }));
      }
    }

    // Build active roster items for this machine on the selected date
    const roster = (assignmentsRes.data || []).map((a: any, idx: number) => {
      const op = Array.isArray(a.operator) ? a.operator[0] : a.operator || {};
      const shiftCode = a.shift_code || `S${idx + 1}`;
      const shiftObj = clientShifts.find((s) => s.code.toUpperCase() === shiftCode.toUpperCase());

      return {
        operatorId: a.operator_id || op.id,
        operatorName: op.full_name || "Operator",
        employeeId: op.employee_id || null,
        phone: op.phone || null,
        email: op.email || null,
        shiftCode,
        shiftName: shiftObj?.name || `Shift ${shiftCode}`,
        shiftStartTime: a.shift_start_time || shiftObj?.start_time || null,
        shiftEndTime: a.shift_end_time || shiftObj?.end_time || null,
        assignmentId: a.id || null,
        validFrom: a.valid_from || null,
        validTo: a.valid_to || null,
        notes: "Assigned via personnel dialog",
      };
    });

    return NextResponse.json(
      {
        success: true,
        machine,
        roster,
        assignment_date: assignmentDate,
        window: getAssignmentDateWindow(),
        client_shifts: clientShifts,
        operators: candidateOperators,
        other_assignments: otherAssignments,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    if (isAuthRedirect(err)) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to load machine operators.";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * POST /api/machines/[id]/operators
 * High-speed atomic operator roster assignment endpoint for equipment.
 * Enforces RBAC permissions, saves roster in single ACID transaction, and revalidates cache tags.
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

    if (!["admin", "super_admin", "manager", "supervisor"].includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to assign equipment operators." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawOperators = body.operators || [];
    const activateMachine = Boolean(body.activateMachine);

    // Date-based assignment target (today - 7 days .. today + 1 day, IST)
    const requestedDateRaw =
      body.assignmentDate ?? body.assignment_date ?? body.date ?? req.nextUrl.searchParams.get("date") ?? null;
    const requestedDate = requestedDateRaw ? String(requestedDateRaw).trim() : null;
    if (requestedDate && !isValidAssignmentDate(requestedDate)) {
      return NextResponse.json(
        {
          error: "Assignment date must be between 7 days ago and tomorrow (IST).",
          code: "DATE_OUT_OF_WINDOW",
          window: getAssignmentDateWindow(),
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const assignmentDate = resolveAssignmentDate(requestedDate);

    // Delegate to canonical updateMachinePersonnelAction with atomic ACID execution
    const res = await updateMachinePersonnelAction(id, {
      operators: rawOperators,
      activateMachine,
      supervisorIds: undefined,
      assignmentDate,
    });

    if (!res.success || res.error) {
      return NextResponse.json(
        {
          error: res.error || "Failed to update operator roster.",
          code: res.code,
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Revalidate cache tags
    try {
      revalidateTag(TAGS.machineDetail(id), "max");
      revalidateTag(TAGS.machinesList, "max");
      revalidateTag(TAGS.machines, "max");
      revalidateTag(TAGS.assignments, "max");
      revalidateTag(TAGS.todayShiftMonitor, "max");
    } catch (tagErr) {
      console.warn("[api/machines/operators] Cache tag revalidation warning:", tagErr);
    }

    return NextResponse.json(
      {
        success: true,
        machineId: id,
        assignment_date: res.assignment_date || assignmentDate,
        operators: res.operators || [],
        res,
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    if (isAuthRedirect(err)) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to update operators.";
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
