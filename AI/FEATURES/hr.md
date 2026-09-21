# Feature Module — Human Resources (HR) & Employee Lifecycle

## Overview
Manages the complete employee lifecycle, onboarding workflows, department & designation master catalogs, salary/CTC history auditing, employee documents, and HR $\rightarrow$ Admin system user account requests.

## File Map
- **Page**: `app/(app)/hr/page.tsx`
- **Client Hub**: `components/hr/HRClient.tsx`
- **Dashboard View Integration**: `app/(app)/dashboard/page.tsx`
- **DAL Queries**: `lib/queries/hr.ts`
- **Server Actions**: `app/actions/hr.ts`
- **RBAC Constants & Matrix**: `lib/auth/rbac.ts`, `lib/auth/scope.ts`
- **Database Types**: `lib/types/database.ts`
- **Database Migrations**: `supabase/migrations/026_hr_manager_role_refinements.sql`

## Key Capabilities & Workflows
1. **Employee Lifecycle Governance**:
   - Statuses: `pending_onboarding` $\rightarrow$ `active` $\rightarrow$ `notice_period` $\rightarrow$ `inactive` $\rightarrow$ `archived` (or `resigned`, `terminated`, `retired`).
   - Hard deletion is strictly prohibited for employees with historical records; status updates transition employees safely.
2. **Onboarding Workflow**:
   - Multi-step sequence (Candidate $\rightarrow$ Employee Created $\rightarrow$ Auto-Assigned Code $\rightarrow$ Department $\rightarrow$ Designation $\rightarrow$ Branch $\rightarrow$ Reporting Manager $\rightarrow$ System User Request).
3. **Master Data Management**:
   - Departments (`public.departments`): Create/Edit/Deactivate departments.
   - Designations (`public.designations`): Create/Edit/Deactivate designations.
4. **Confidential Salary & Compensation Auditing**:
   - Protected by `employee.salary.view` (`hr:read_salary`).
   - Revision entries append to `public.employee_salary_history` with fixed, variable, CTC, effective date, and creator audit stamp.
5. **User Account Requests**:
   - HR Managers submit user account creation/deactivation requests to Admins via `public.user_account_requests`.
6. **Document Repository**:
   - Manage joining, identity, qualification, employment, offer letter, appointment letter, resignation, and experience document metadata via `public.employee_documents`.
7. **HR & Operator Payroll Engine (`/hr`, `/payroll`) (Migrations 094 & 095)**:
   - **Accessible Roles**: `super_admin`, `admin`, `manager`, `hr` (guarded at Edge Proxy `proxy.ts`, DAL `requireRole`, and PostgreSQL RPCs).
   - **Split-Month Overtime Lag Formula**:
     $$\text{Total Pay} = (\text{Work Days}_{\text{Previous Month}} \times \text{Daily Rate}) + (\text{OT Hours}_{\text{Month Before Previous}} \times \text{Hourly OT Rate})$$
   - **PostgreSQL RPCs**:
     - `get_hr_payroll_summary(p_payroll_month)`: Computes previous month work days and lagged 1-month overtime hours in <5ms.
     - `update_operator_payroll_rates(p_operator_id, p_daily_rate, p_ot_hourly_rate)`: Atomic operator rate update with caller role verification.
     - `bulk_update_operator_payroll_rates(p_updates)`: Atomic multi-operator rate batch update.
   - **Cross-Platform Features**: Desktop table + mobile touch cards, month selector, 4 KPI cards, search, inline rate editing, bulk update modal, and CSV export.
