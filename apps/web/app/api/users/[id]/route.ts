import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  resolveUserId,
  getUserById,
  getUserSummaryKPIs,
  getUserAssignedMachines,
  getUserRunningLogs,
  getUserAssignments,
  getUserAuditLogs,
} from "@/lib/data/users";
import { getUserDocumentsAction, getDocumentTypesAction } from "@/app/actions/documents";
import { getSupervisorsAction } from "@/app/actions/auth";
import { generateUserFormattedPassword } from "@/app/actions/users";
import { logAudit } from "@/lib/audit";
import { maskAadhaar } from "@reachinternational/utils";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

/**
 * Handle CORS preflight OPTIONS requests for mobile and web clients.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function jsonResponse(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      ...init?.headers,
    },
  });
}

/**
 * Custom designed high-performance API Route for user details & lazy-loaded tab telemetry.
 * GET /api/users/[id]?tab=overview|machines|logs|assignments|attendance|documents|audit&limit=50
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    if (!rawId) {
      return jsonResponse(
        { success: false, error: "User identifier is required" },
        { status: 400 }
      );
    }

    // 1. Authenticate caller (supports Supabase SSR cookies or Bearer Authorization header)
    const adminClient = createSupabaseAdminClient();
    let callerUser: { id: string; role: string } | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data: tokenData, error: tokenErr } = await adminClient.auth.getUser(token);
      if (!tokenErr && tokenData?.user) {
        const { data: dbUser } = await adminClient
          .from("users")
          .select("id, role")
          .eq("id", tokenData.user.id)
          .maybeSingle();

        if (dbUser) {
          callerUser = { id: dbUser.id, role: dbUser.role };
        }
      }
    }

    if (!callerUser) {
      // Fall back to server cookie session
      try {
        const supabase = await createSupabaseServerClient();
        const { data: sessionData } = await supabase.auth.getUser();
        if (sessionData?.user) {
          const { data: dbUser } = await adminClient
            .from("users")
            .select("id, role")
            .eq("id", sessionData.user.id)
            .maybeSingle();

          if (dbUser) {
            callerUser = { id: dbUser.id, role: dbUser.role };
          }
        }
      } catch {
        // Cookie extraction fallback
      }
    }

    if (!callerUser) {
      return jsonResponse(
        { success: false, error: "Unauthorized. Authentication is required." },
        { status: 401 }
      );
    }

    // 2. Resolve canonical User UUID from ID or Employee Code (e.g. EMP-0036)
    const userId = await resolveUserId(decodeURIComponent(rawId));
    if (!userId) {
      return jsonResponse(
        { success: false, error: "Employee account not found" },
        { status: 404 }
      );
    }

    // 3. Strict RBAC Enforcement
    const isAuthorizedStaff = [
      "super_admin",
      "admin",
      "manager",
      "hr",
      "supervisor",
    ].includes(callerUser.role);
    const isSelf = callerUser.id === userId;

    if (!isAuthorizedStaff && !isSelf) {
      return jsonResponse(
        { success: false, error: "Forbidden. Insufficient permissions to inspect this user profile." },
        { status: 403 }
      );
    }

    // 4. Tab dispatch for optimized lazy-loading
    const searchParams = request.nextUrl.searchParams;
    const tab = (searchParams.get("tab") || "overview").toLowerCase();
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

    const isManagement = ["super_admin", "admin", "manager", "hr"].includes(callerUser.role);
    const canViewSalary = isManagement || isSelf;
    const canViewUnmaskedAadhaar = ["super_admin", "admin", "hr"].includes(callerUser.role) || isSelf;

    switch (tab) {
      case "machines": {
        const machines = await getUserAssignedMachines(userId);
        return jsonResponse(
          { success: true, tab: "machines", machines, count: machines.length },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }

      case "logs": {
        const runningLogs = await getUserRunningLogs(userId, limit);
        return jsonResponse(
          { success: true, tab: "logs", runningLogs, count: runningLogs.length },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }

      case "assignments": {
        const assignments = await getUserAssignments(userId);
        return jsonResponse(
          { success: true, tab: "assignments", assignments, count: assignments.length },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }

      case "attendance": {
        // Fetch running logs to compute verified telemetry & timesheet
        const { data: logsData } = await adminClient
          .from("machine_hour_logs")
          .select("id, log_date, start_time, end_time, running_hours, overtime_hours, normal_working_hours, remarks")
          .or(`operator_id.eq.${userId},supervisor_id.eq.${userId}`)
          .order("log_date", { ascending: false })
          .limit(100);

        const logs = logsData || [];
        const totalRunningHours = logs.reduce((acc, row) => acc + (Number(row.running_hours) || 0), 0);
        const distinctDates = new Set(logs.map((l) => l.log_date).filter(Boolean));

        return jsonResponse(
          {
            success: true,
            tab: "attendance",
            stats: {
              totalActiveWorkDays: distinctDates.size,
              totalRunningHours: Math.round(totalRunningHours * 10) / 10,
            },
            recentLogs: logs.slice(0, 30),
          },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }

      case "documents": {
        const [documents, docTypes] = await Promise.all([
          getUserDocumentsAction(userId).catch(() => []),
          getDocumentTypesAction().catch(() => []),
        ]);
        return jsonResponse(
          {
            success: true,
            tab: "documents",
            documents: documents || [],
            documentTypes: docTypes || [],
            count: (documents || []).length,
          },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }

      case "audit": {
        // RBAC guard: Audit Trail is strictly for management roles
        if (!isManagement) {
          return jsonResponse(
            { success: false, error: "Audit Trail is restricted to Management staff." },
            { status: 403 }
          );
        }
        const auditLogs = await getUserAuditLogs(userId, limit);
        return jsonResponse(
          { success: true, tab: "audit", auditLogs, count: auditLogs.length },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }

      case "overview":
      default: {
        const [user, kpis, supervisors] = await Promise.all([
          getUserById(userId),
          getUserSummaryKPIs(userId),
          getSupervisorsAction().catch(() => []),
        ]);

        if (!user) {
          return jsonResponse(
            { success: false, error: "Employee account not found or has been archived." },
            { status: 404 }
          );
        }

        // PII & Compensation Masking
        const sanitizedUser: any = { ...user };
        if (!canViewSalary) {
          delete sanitizedUser.monthly_salary;
          delete sanitizedUser.daily_rate;
          delete sanitizedUser.ot_hourly_rate;
          delete sanitizedUser.bank_account_number;
          delete sanitizedUser.bank_ifsc_code;
        }

        if (!canViewUnmaskedAadhaar && sanitizedUser.aadhaar_number) {
          sanitizedUser.aadhaar_number = maskAadhaar(sanitizedUser.aadhaar_number);
        }

        return jsonResponse(
          {
            success: true,
            tab: "overview",
            user: sanitizedUser,
            kpis,
            supervisors: Array.isArray(supervisors) ? supervisors : [],
          },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } }
        );
      }
    }
  } catch (err: unknown) {
    console.error("[UserDetailAPI] Error processing request:", err);
    return jsonResponse(
      { success: false, error: "Internal server error occurred while retrieving user details." },
      { status: 500 }
    );
  }
}

/**
 * Handles state mutations for user account (e.g. password reset).
 * POST /api/users/[id]
 * Body: { action: "reset-password" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    if (!rawId) {
      return jsonResponse(
        { success: false, error: "User identifier is required" },
        { status: 400 }
      );
    }

    // 1. Authenticate caller (supports Supabase SSR cookies or Bearer Authorization header)
    const adminClient = createSupabaseAdminClient();
    let callerUser: { id: string; role: string; full_name?: string; email?: string } | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data: tokenData, error: tokenErr } = await adminClient.auth.getUser(token);
      if (!tokenErr && tokenData?.user) {
        const { data: dbUser } = await adminClient
          .from("users")
          .select("id, role, full_name, email")
          .eq("id", tokenData.user.id)
          .maybeSingle();

        if (dbUser) {
          callerUser = dbUser;
        }
      }
    }

    if (!callerUser) {
      try {
        const supabase = await createSupabaseServerClient();
        const { data: sessionData } = await supabase.auth.getUser();
        if (sessionData?.user) {
          const { data: dbUser } = await adminClient
            .from("users")
            .select("id, role, full_name, email")
            .eq("id", sessionData.user.id)
            .maybeSingle();

          if (dbUser) {
            callerUser = dbUser;
          }
        }
      } catch {
        // Fallback
      }
    }

    if (!callerUser) {
      return jsonResponse(
        { success: false, error: "Unauthorized. Authentication is required." },
        { status: 401 }
      );
    }

    const userId = await resolveUserId(decodeURIComponent(rawId));
    if (!userId) {
      return jsonResponse(
        { success: false, error: "Employee account not found" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action || "reset-password";

    if (action === "reset-password") {
      // Strict RBAC: Only admin or super_admin can reset staff passwords
      if (!["admin", "super_admin"].includes(callerUser.role)) {
        return jsonResponse(
          { success: false, error: "Forbidden. Insufficient permissions to reset passwords." },
          { status: 403 }
        );
      }

      // 1. Target user verification
      const { data: targetUser, error: fetchError } = await adminClient
        .from("users")
        .select("id, full_name, email, role")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError || !targetUser) {
        return jsonResponse(
          { success: false, error: "Target user account not found." },
          { status: 404 }
        );
      }

      if (callerUser.role === "admin" && targetUser.role === "super_admin") {
        return jsonResponse(
          { success: false, error: "Only Super Admins can reset passwords for Super Admin accounts." },
          { status: 403 }
        );
      }

      if (targetUser.id === callerUser.id) {
        return jsonResponse(
          { success: false, error: "Please use the Change Password option in Settings to change your own password." },
          { status: 400 }
        );
      }

      // 2. Generate formatted password: userfirstname@random4digitnumber (e.g. "Rohit@4821")
      const newPassword = await generateUserFormattedPassword(targetUser.full_name);

      // 3. Update password in auth database using admin client
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        console.error("Error resetting password via Admin API:", updateError);
        return jsonResponse(
          { success: false, error: "Failed to reset password in authentication service." },
          { status: 500 }
        );
      }

      // Log audit
      logAudit({
        action: "user.password_reset",
        entity_type: "user",
        entity_id: userId,
        user_id: callerUser.id,
        metadata: {
          user_email: targetUser.email,
          user_name: targetUser.full_name,
          reset_by: callerUser.email,
          reset_by_name: callerUser.full_name,
        },
      }).catch((auditErr) => {
        console.error("Error logging password reset audit:", auditErr);
      });

      return jsonResponse({
        success: true,
        userName: targetUser.full_name,
        temporaryPassword: newPassword,
        message: `Password for ${targetUser.full_name} has been reset successfully.`,
      });
    }

    return jsonResponse(
      { success: false, error: `Unsupported action "${action}".` },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("[UserDetailAPI] Error processing POST action:", err);
    return jsonResponse(
      { success: false, error: "Internal server error occurred while processing action." },
      { status: 500 }
    );
  }
}
