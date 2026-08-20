"use client";

import { useState, useMemo } from "react";
import {
  AnimatedUsers,
  AnimatedUserPlus,
  AnimatedBuilding2,
  AnimatedBriefcase,
  AnimatedShieldCheck,
  AnimatedMail,
  AnimatedPhone,
  AnimatedCalendarClock,
  AnimatedFileText,
  AnimatedClipboardList,
  AnimatedStar,
  AnimatedSettings,
  AnimatedBarChart3,
  AnimatedRefresh,
  AnimatedAlertTriangle,
  AnimatedGauge,
  AnimatedWrench,
} from "@/components/ui/animated-icons";
import type { 
  Employee, 
  Branch, 
  User, 
  Department, 
  Designation, 
  EmployeeSalaryHistory, 
  EmployeeDocument, 
  UserAccountRequest,
  EmployeeStatus,
  EmploymentType,
  UserRole
} from "@/lib/types/database";
import type { HRDashboardMetrics } from "@/lib/queries/hr";
import { 
  createEmployeeAction, 
  updateEmployeeAction,
  changeEmployeeStatusAction, 
  createSalaryRevisionAction,
  manageDepartmentAction,
  manageDesignationAction,
  requestUserAccountAction,
  uploadEmployeeDocumentAction
} from "@/app/actions/hr";

import { Select } from "@/components/ui";

export interface HRClientProps {
  employees: Employee[];
  branches: Branch[];
  users: User[];
  departments: Department[];
  designations: Designation[];
  salaryHistory: EmployeeSalaryHistory[];
  documents: EmployeeDocument[];
  userRequests: UserAccountRequest[];
  metrics: HRDashboardMetrics;
  canViewSalary: boolean;
  canCreateEmployee?: boolean;
  initialTab?: string;
}

export function HRClient({
  employees,
  branches,
  users,
  departments,
  designations,
  salaryHistory,
  documents,
  userRequests,
  metrics,
  canViewSalary,
  canCreateEmployee = true,
  initialTab = "dashboard",
}: HRClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  // Modals state
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showDesigModal, setShowDesigModal] = useState(false);
  const [showUserReqModal, setShowUserReqModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State: Employee Creation / Onboarding
  const [fullName, setFullName] = useState("");
  const [designationTitle, setDesignationTitle] = useState("");
  const [departmentName, setDepartmentName] = useState("Operations");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split("T")[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("full_time");
  const [status, setStatus] = useState<EmployeeStatus>("active");
  const [salary, setSalary] = useState<number | "">("");
  const [fixedComponent, setFixedComponent] = useState<number | "">("");
  const [variableComponent, setVariableComponent] = useState<number | "">("");
  const [ctc, setCtc] = useState<number | "">("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  // Form State: Status Change
  const [newStatus, setNewStatus] = useState<EmployeeStatus>("active");
  const [statusNotes, setStatusNotes] = useState("");

  // Form State: Salary Revision
  const [revSalary, setRevSalary] = useState<number | "">("");
  const [revFixed, setRevFixed] = useState<number | "">("");
  const [revVariable, setRevVariable] = useState<number | "">("");
  const [revCtc, setRevCtc] = useState<number | "">("");
  const [revEffectiveDate, setRevEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [revNotes, setRevNotes] = useState("");

  // Form State: Department
  const [deptCode, setDeptCode] = useState("");
  const [deptTitle, setDeptTitle] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  // Form State: Designation
  const [desigCode, setDesigCode] = useState("");
  const [desigTitle, setDesigTitle] = useState("");
  const [desigDeptCode, setDesigDeptCode] = useState("DEP-SERVICE");
  const [desigDesc, setDesigDesc] = useState("");

  // Form State: User Request
  const [reqType, setReqType] = useState<"create_account" | "deactivate_account" | "role_change">("create_account");
  const [reqRole, setReqRole] = useState<UserRole>("service_engineer");
  const [reqNotes, setReqNotes] = useState("");

  // Form State: Document
  const [docType, setDocType] = useState<"joining" | "identity" | "qualification" | "employment" | "offer_letter" | "appointment_letter" | "resignation" | "experience" | "other">("identity");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const matchesSearch =
        e.full_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      const matchesDept = departmentFilter === "all" || e.department === departmentFilter;
      const matchesBranch = branchFilter === "all" || e.branch_id === branchFilter;

      return matchesSearch && matchesStatus && matchesDept && matchesBranch;
    });
  }, [employees, search, statusFilter, departmentFilter, branchFilter]);

  // Handle Create Employee / Onboarding
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const res = await createEmployeeAction({
      fullName,
      designation: designationTitle,
      department: departmentName,
      branchId: branchId || undefined,
      reportingManagerId: reportingManagerId || undefined,
      joiningDate,
      phone: phone || undefined,
      email: email || undefined,
      employmentType,
      status,
      salary: salary ? Number(salary) : undefined,
      fixedComponent: fixedComponent ? Number(fixedComponent) : undefined,
      variableComponent: variableComponent ? Number(variableComponent) : undefined,
      ctc: ctc ? Number(ctc) : undefined,
      bankName: bankName || undefined,
      accountNumber: accountNumber || undefined,
      ifscCode: ifscCode || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowOnboardModal(false);
      resetEmployeeForm();
    } else {
      alert(`Error onboarding employee: ${res.error}`);
    }
  };

  // Handle Edit Employee
  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);

    const res = await updateEmployeeAction({
      id: selectedEmployee.id,
      fullName,
      designation: designationTitle,
      department: departmentName,
      branchId: branchId || undefined,
      reportingManagerId: reportingManagerId || undefined,
      joiningDate,
      phone: phone || undefined,
      email: email || undefined,
      employmentType,
      bankName: bankName || undefined,
      accountNumber: accountNumber || undefined,
      ifscCode: ifscCode || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowEditModal(false);
      setSelectedEmployee(null);
    } else {
      alert(`Error updating employee: ${res.error}`);
    }
  };

  // Handle Status Change
  const handleChangeStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);

    const res = await changeEmployeeStatusAction({
      employeeId: selectedEmployee.id,
      status: newStatus,
      notes: statusNotes || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowStatusModal(false);
      setSelectedEmployee(null);
      setStatusNotes("");
    } else {
      alert(`Error changing status: ${res.error}`);
    }
  };

  // Handle Salary Revision
  const handleCreateSalaryRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !revSalary) return;
    setSubmitting(true);

    const res = await createSalaryRevisionAction({
      employeeId: selectedEmployee.id,
      salary: Number(revSalary),
      fixedComponent: revFixed ? Number(revFixed) : Number(revSalary),
      variableComponent: revVariable ? Number(revVariable) : 0,
      ctc: revCtc ? Number(revCtc) : Number(revSalary) * 12,
      effectiveDate: revEffectiveDate,
      notes: revNotes || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowSalaryModal(false);
      setSelectedEmployee(null);
      setRevSalary("");
      setRevNotes("");
    } else {
      alert(`Error creating salary revision: ${res.error}`);
    }
  };

  // Handle Manage Department
  const handleManageDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode || !deptTitle) return;
    setSubmitting(true);

    const res = await manageDepartmentAction({
      code: deptCode,
      name: deptTitle,
      description: deptDesc || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowDeptModal(false);
      setDeptCode("");
      setDeptTitle("");
      setDeptDesc("");
    } else {
      alert(`Error creating department: ${res.error}`);
    }
  };

  // Handle Manage Designation
  const handleManageDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigCode || !desigTitle) return;
    setSubmitting(true);

    const res = await manageDesignationAction({
      code: desigCode,
      title: desigTitle,
      departmentCode: desigDeptCode || undefined,
      description: desigDesc || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowDesigModal(false);
      setDesigCode("");
      setDesigTitle("");
      setDesigDesc("");
    } else {
      alert(`Error creating designation: ${res.error}`);
    }
  };

  // Handle Request User Account
  const handleRequestUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);

    const res = await requestUserAccountAction({
      employeeId: selectedEmployee.id,
      requestType: reqType,
      requestedRole: reqRole,
      targetBranchId: selectedEmployee.branch_id || undefined,
      adminNotes: reqNotes || undefined,
    });

    setSubmitting(false);

    if (res.success) {
      setShowUserReqModal(false);
      setSelectedEmployee(null);
      setReqNotes("");
    } else {
      alert(`Error requesting user account: ${res.error}`);
    }
  };

  // Handle Upload Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !docName || !docUrl) return;
    setSubmitting(true);

    const res = await uploadEmployeeDocumentAction({
      employeeId: selectedEmployee.id,
      documentType: docType,
      fileName: docName,
      fileUrl: docUrl,
    });

    setSubmitting(false);

    if (res.success) {
      setShowDocModal(false);
      setSelectedEmployee(null);
      setDocName("");
      setDocUrl("");
    } else {
      alert(`Error uploading document record: ${res.error}`);
    }
  };

  const resetEmployeeForm = () => {
    setFullName("");
    setDesignationTitle("");
    setDepartmentName("Operations");
    setBranchId(branches[0]?.id || "");
    setReportingManagerId("");
    setPhone("");
    setEmail("");
    setSalary("");
    setFixedComponent("");
    setVariableComponent("");
    setCtc("");
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFullName(emp.full_name);
    setDesignationTitle(emp.designation);
    setDepartmentName(emp.department || "Operations");
    setBranchId(emp.branch_id || branches[0]?.id || "");
    setReportingManagerId(emp.reporting_manager_id || "");
    setJoiningDate(emp.joining_date || new Date().toISOString().split("T")[0]);
    setPhone(emp.phone || "");
    setEmail(emp.email || "");
    setEmploymentType(emp.employment_type);
    setBankName(emp.bank_name || "");
    setAccountNumber(emp.account_number || "");
    setIfscCode(emp.ifsc_code || "");
    setShowEditModal(true);
  };

  const openStatusModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setNewStatus(emp.status);
    setStatusNotes("");
    setShowStatusModal(true);
  };

  const openSalaryModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setRevSalary(emp.salary || "");
    setRevFixed(emp.salary || "");
    setRevVariable(0);
    setRevCtc(emp.salary ? emp.salary * 12 : "");
    setRevEffectiveDate(new Date().toISOString().split("T")[0]);
    setRevNotes("");
    setShowSalaryModal(true);
  };

  const openUserReqModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setReqType(emp.user_id ? "deactivate_account" : "create_account");
    setReqRole("service_engineer");
    setReqNotes("");
    setShowUserReqModal(true);
  };

  const openDocModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDocName("");
    setDocUrl("");
    setShowDocModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--color-ink)] flex items-center gap-2">
            <AnimatedUsers size={22} className="text-sky-600 dark:text-sky-400" />
            Human Resources Management Suite
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Employee lifecycle, master data, onboarding, salary history, user requests, and HR compliance.
          </p>
        </div>

        {canCreateEmployee && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetEmployeeForm();
                setShowOnboardModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <AnimatedUserPlus size={16} /> Onboard Employee
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-[var(--color-hairline)] overflow-x-auto pb-1 text-xs font-bold">
        {[
          { id: "dashboard", label: "HR Dashboard", icon: AnimatedGauge },
          { id: "employees", label: `Employees (${employees.length})`, icon: AnimatedUsers },
          { id: "onboarding", label: `Onboarding (${metrics.pending_onboarding})`, icon: AnimatedClipboardList },
          { id: "departments", label: `Departments (${departments.length})`, icon: AnimatedBuilding2 },
          { id: "designations", label: `Designations (${designations.length})`, icon: AnimatedStar },
          ...(canViewSalary ? [{ id: "payroll", label: "Salary & Payroll", icon: AnimatedFileText }] : []),
          { id: "user_requests", label: `User Requests (${userRequests.filter((r) => r.status === "pending").length})`, icon: AnimatedSettings },
          { id: "documents", label: `Documents (${documents.length})`, icon: AnimatedFileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: HR DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold uppercase text-[var(--color-mute)]">Total Headcount</p>
              <p className="text-2xl font-black text-[var(--color-ink)]">{metrics.total_employees}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{metrics.active_employees} Active</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold uppercase text-[var(--color-mute)]">Active Duty</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.active_employees}</p>
              <p className="text-[10px] text-[var(--color-mute)]">{((metrics.active_employees / (metrics.total_employees || 1)) * 100).toFixed(0)}% of total</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold uppercase text-[var(--color-mute)]">Pending Onboarding</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.pending_onboarding}</p>
              <p className="text-[10px] text-amber-600 font-semibold">Requires Setup</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold uppercase text-[var(--color-mute)]">Notice Period</p>
              <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{metrics.notice_period}</p>
              <p className="text-[10px] text-[var(--color-mute)]">Upcoming Exits</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold uppercase text-[var(--color-mute)]">Inactive / Exited</p>
              <p className="text-2xl font-black text-slate-600 dark:text-slate-400">{metrics.inactive_employees}</p>
              <p className="text-[10px] text-[var(--color-mute)]">Preserved History</p>
            </div>
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1">
              <p className="text-[10px] font-extrabold uppercase text-[var(--color-mute)]">New Joiners (30d)</p>
              <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{metrics.new_employees}</p>
              <p className="text-[10px] text-sky-600 font-semibold">Recent Recruits</p>
            </div>
          </div>

          {/* Distribution Section Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* By Branch */}
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center justify-between">
                <span>Workforce by Branch</span>
                <span className="text-xs font-semibold text-purple-600">{metrics.by_branch.length} Branches</span>
              </h2>
              <div className="space-y-2 text-xs">
                {metrics.by_branch.map((b) => (
                  <div key={b.branch_id} className="space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{b.branch_name}</span>
                      <span className="text-[var(--color-mute)]">{b.count} staff</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--color-canvas)] overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${Math.min(100, (b.count / (metrics.total_employees || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Department */}
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center justify-between">
                <span>Staff by Department</span>
                <span className="text-xs font-semibold text-sky-600">{metrics.by_department.length} Depts</span>
              </h2>
              <div className="space-y-2 text-xs">
                {metrics.by_department.map((d) => (
                  <div key={d.department} className="flex items-center justify-between p-2 rounded-xl bg-[var(--color-canvas)]">
                    <span className="font-semibold">{d.department}</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-extrabold text-[11px]">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Records Pending Updates & Recent Activity */}
            <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center justify-between">
                <span>Profiles Requiring Update</span>
                <span className="text-xs font-semibold text-amber-600">{metrics.records_requiring_update.length} Action Needed</span>
              </h2>
              <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
                {metrics.records_requiring_update.length === 0 ? (
                  <p className="text-[var(--color-mute)] text-center py-4">All active employee master records complete.</p>
                ) : (
                  metrics.records_requiring_update.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-300">{e.full_name}</p>
                        <p className="text-[10px] text-[var(--color-mute)]">{e.designation} • {e.employee_code}</p>
                      </div>
                      <button
                        onClick={() => openEditModal(e)}
                        className="px-2 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px]"
                      >
                        Update
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEES DIRECTORY */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee code, designation, department..."
              className="px-3.5 py-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] focus:outline-none"
            />

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Employee Statuses" },
                { value: "pending_onboarding", label: "Pending Onboarding" },
                { value: "active", label: "Active Duty" },
                { value: "notice_period", label: "Notice Period" },
                { value: "on_leave", label: "On Leave" },
                { value: "resigned", label: "Resigned" },
                { value: "terminated", label: "Terminated" },
                { value: "retired", label: "Retired" },
                { value: "inactive", label: "Inactive" },
                { value: "archived", label: "Archived" },
              ]}
            />

            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              options={[
                { value: "all", label: "All Departments" },
                ...departments.map((d) => ({ value: d.name, label: d.name })),
              ]}
            />

            <Select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              options={[
                { value: "all", label: "All Branches" },
                ...branches.map((b) => ({ value: b.id, label: `${b.name} (${b.city})` })),
              ]}
            />
          </div>

          {/* Directory Table */}
          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-4 py-3">Code & Name</th>
                  <th className="px-4 py-3">Designation & Dept</th>
                  <th className="px-4 py-3">Branch Location</th>
                  <th className="px-4 py-3">Reporting Manager</th>
                  <th className="px-4 py-3">Contact Details</th>
                  {canViewSalary && <th className="px-4 py-3">Salary & Banking</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={canViewSalary ? 8 : 7} className="px-4 py-8 text-center text-[var(--color-mute)]">
                      No matching employee master records found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-sky-600 dark:text-sky-400">{emp.employee_code}</p>
                        <p className="font-bold text-sm text-[var(--color-ink)]">{emp.full_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold">{emp.designation}</p>
                        <p className="text-[11px] text-[var(--color-mute)]">{emp.department || "Operations"}</p>
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {emp.branch?.name || "Unassigned HQ"}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {emp.reporting_manager ? (
                          <span className="font-semibold text-purple-600 dark:text-purple-400">{emp.reporting_manager.full_name}</span>
                        ) : (
                          <span className="text-[var(--color-mute)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 space-y-0.5 text-[11px]">
                        {emp.phone && <p className="flex items-center gap-1"><AnimatedPhone size={12} className="text-sky-500" /> {emp.phone}</p>}
                        {emp.email && <p className="flex items-center gap-1 text-[var(--color-mute)]"><AnimatedMail size={12} className="text-purple-500" /> {emp.email}</p>}
                      </td>
                      {canViewSalary && (
                        <td className="px-4 py-3 space-y-0.5 text-[11px]">
                          <p className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            {emp.salary ? `₹${Number(emp.salary).toLocaleString("en-IN")}/mo` : "Not set"}
                          </p>
                          {emp.bank_name && (
                            <p className="text-[var(--color-mute)] font-mono text-[10px]">
                              {emp.bank_name} ({emp.account_number?.slice(-4) ? `*${emp.account_number.slice(-4)}` : "A/C"})
                            </p>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold capitalize ${
                          emp.status === "active"
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                            : emp.status === "pending_onboarding"
                            ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                            : emp.status === "notice_period"
                            ? "bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300"
                            : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-300"
                        }`}>
                          {emp.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="px-2 py-1 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] text-[10px] font-bold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openStatusModal(emp)}
                          className="px-2 py-1 rounded-lg bg-sky-600 text-white hover:bg-sky-700 text-[10px] font-bold"
                        >
                          Status
                        </button>
                        {canViewSalary && (
                          <button
                            onClick={() => openSalaryModal(emp)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] font-bold"
                          >
                            Salary
                          </button>
                        )}
                        <button
                          onClick={() => openUserReqModal(emp)}
                          className="px-2 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-[10px] font-bold"
                        >
                          Account Req
                        </button>
                        <button
                          onClick={() => openDocModal(emp)}
                          className="px-2 py-1 rounded-lg bg-slate-700 text-white hover:bg-slate-800 text-[10px] font-bold"
                        >
                          Docs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ONBOARDING WORKFLOW */}
      {activeTab === "onboarding" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedClipboardList size={18} className="text-sky-600" />
              Standardized Employee Onboarding Flow
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
              {[
                { step: "1", title: "New Candidate", desc: "Form Initiated" },
                { step: "2", title: "Employee Created", desc: "Record Generated" },
                { step: "3", title: "Employee ID", desc: "Auto-Assigned" },
                { step: "4", title: "Department", desc: "Master Mapped" },
                { step: "5", title: "Designation", desc: "Role Set" },
                { step: "6", title: "Branch Allocation", desc: "Site Assigned" },
                { step: "7", title: "Reporting Mgr", desc: "Supervisor Linked" },
                { step: "8", title: "System User", desc: "Account Requested" },
              ].map((s) => (
                <div key={s.step} className="p-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1">
                  <span className="inline-block w-5 h-5 rounded-full bg-sky-600 text-white font-black text-[10px] leading-5">
                    {s.step}
                  </span>
                  <p className="font-bold text-[11px] text-[var(--color-ink)]">{s.title}</p>
                  <p className="text-[10px] text-[var(--color-mute)]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-[var(--color-mute)]">Pending Onboardings ({metrics.pending_onboarding})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.filter((e) => e.status === "pending_onboarding").length === 0 ? (
                <div className="col-span-full p-6 text-center text-xs text-[var(--color-mute)] border border-[var(--color-hairline)] rounded-2xl bg-[var(--color-canvas-elevated)]">
                  No employees currently pending onboarding. All joiners fully setup.
                </div>
              ) : (
                employees
                  .filter((e) => e.status === "pending_onboarding")
                  .map((emp) => (
                    <div key={emp.id} className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-[var(--color-ink)]">{emp.full_name}</p>
                          <p className="text-xs text-sky-600 font-mono font-bold">{emp.employee_code}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 text-[10px] font-bold">
                          Pending Setup
                        </span>
                      </div>
                      <div className="text-xs space-y-1 text-[var(--color-mute)]">
                        <p><strong className="text-[var(--color-ink)]">Designation:</strong> {emp.designation}</p>
                        <p><strong className="text-[var(--color-ink)]">Branch:</strong> {emp.branch?.name || "Pending"}</p>
                        <p><strong className="text-[var(--color-ink)]">Joining Date:</strong> {emp.joining_date}</p>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-[var(--color-hairline)]">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="flex-1 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold"
                        >
                          Complete Profile
                        </button>
                        <button
                          onClick={() => openStatusModal(emp)}
                          className="py-1.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                        >
                          Activate
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEPARTMENTS & DESIGNATIONS */}
      {(activeTab === "departments" || activeTab === "designations") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Departments */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <AnimatedBuilding2 size={18} className="text-sky-600" />
                Departments Master ({departments.length})
              </h2>
              <button
                onClick={() => setShowDeptModal(true)}
                className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold"
              >
                + Add Dept
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {departments.map((d) => (
                <div key={d.id} className="flex justify-between items-center p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                  <div>
                    <p className="font-bold text-[var(--color-ink)]">{d.name} <span className="text-[10px] font-mono text-sky-600">({d.code})</span></p>
                    <p className="text-[10px] text-[var(--color-mute)]">{d.description || "Active department unit"}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Designations */}
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
                <AnimatedStar size={18} className="text-purple-600" />
                Designations Master ({designations.length})
              </h2>
              <button
                onClick={() => setShowDesigModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold"
              >
                + Add Designation
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {designations.map((d) => (
                <div key={d.id} className="flex justify-between items-center p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                  <div>
                    <p className="font-bold text-[var(--color-ink)]">{d.title} <span className="text-[10px] font-mono text-purple-600">({d.code})</span></p>
                    <p className="text-[10px] text-[var(--color-mute)]">{d.department_code || "General"}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SALARY & PAYROLL */}
      {activeTab === "payroll" && canViewSalary && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={18} className="text-emerald-600" />
              Confidential Compensation & Salary Revision Auditing
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              All compensation changes automatically generate immutable revision audit records. Historical entries are preserved for finance & compliance.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-4 py-3">Effective Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Monthly Salary</th>
                  <th className="px-4 py-3">Fixed / Variable</th>
                  <th className="px-4 py-3">Annual CTC</th>
                  <th className="px-4 py-3">Notes & Reason</th>
                  <th className="px-4 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {salaryHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-mute)]">
                      No salary revision logs recorded. Perform a "Salary Revision" from the Employee Directory.
                    </td>
                  </tr>
                ) : (
                  salaryHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3 font-mono font-bold text-sky-600">{s.effective_date}</td>
                      <td className="px-4 py-3 font-bold">{employees.find((e) => e.id === s.employee_id)?.full_name || "Employee"}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-600">₹{Number(s.salary).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-[11px]">₹{Number(s.fixed_component).toLocaleString("en-IN")} / ₹{Number(s.variable_component).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-bold">₹{Number(s.ctc || s.salary * 12).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-[11px] text-[var(--color-mute)]">{s.notes || "Salary adjustment"}</td>
                      <td className="px-4 py-3 text-[11px]">{s.creator?.full_name || s.creator?.email || "HR Manager"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: USER REQUESTS */}
      {activeTab === "user_requests" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedSettings size={18} className="text-purple-600" />
              HR $\rightarrow$ Admin User Account Requests
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              HR Managers issue user account creation, deactivation, and role assignment requests to System Administrators.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Request Type</th>
                  <th className="px-4 py-3">Requested Role</th>
                  <th className="px-4 py-3">Target Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Admin Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {userRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-mute)]">
                      No pending or processed user account requests.
                    </td>
                  </tr>
                ) : (
                  userRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3 font-mono text-[11px]">{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 font-bold">{r.employee?.full_name || "Employee"} ({r.employee?.employee_code})</td>
                      <td className="px-4 py-3 font-semibold capitalize">{r.request_type.replace("_", " ")}</td>
                      <td className="px-4 py-3 font-mono font-bold text-purple-600">{r.requested_role}</td>
                      <td className="px-4 py-3">{r.branch?.name || "Main HQ"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                          r.status === "approved" || r.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[var(--color-mute)]">{r.admin_notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-3">
            <h2 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={18} className="text-sky-600" />
              Employee Document Repository
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Joining documents, identity verification, qualifications, offer letters, appointment letters, and experience certificates.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-canvas)] text-[var(--color-mute)] uppercase font-extrabold border-b border-[var(--color-hairline)]">
                <tr>
                  <th className="px-4 py-3">Document Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Uploaded Date</th>
                  <th className="px-4 py-3 text-right">View Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)] font-medium text-[var(--color-ink)]">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-mute)]">
                      No employee document records uploaded. Click "Docs" in the Employee Directory to upload.
                    </td>
                  </tr>
                ) : (
                  documents.map((d) => (
                    <tr key={d.id} className="hover:bg-[var(--color-hairline-soft-surface)]">
                      <td className="px-4 py-3 font-bold text-sky-600">{d.file_name}</td>
                      <td className="px-4 py-3 font-semibold uppercase text-[10px]">{d.document_type.replace("_", " ")}</td>
                      <td className="px-4 py-3 font-bold">{employees.find((e) => e.id === d.employee_id)?.full_name || "Employee"}</td>
                      <td className="px-4 py-3 text-[11px]">{new Date(d.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold">
                          Open Attachment
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ONBOARD EMPLOYEE */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedUserPlus size={20} className="text-sky-600" />
              Onboard New Employee
            </h2>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={designationTitle}
                    onChange={(e) => setDesignationTitle(e.target.value)}
                    placeholder="e.g. Service Engineer"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Department"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  options={departments.map((d) => ({ value: d.name, label: d.name }))}
                />
                <Select
                  label="Branch Location"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  options={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.city})` }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Reporting Manager"
                  value={reportingManagerId}
                  onChange={(e) => setReportingManagerId(e.target.value)}
                  options={[
                    { value: "", label: "None (Top Level)" },
                    ...employees.map((e) => ({ value: e.id, label: `${e.full_name} (${e.designation})` })),
                  ]}
                />
                <div>
                  <label className="block text-xs font-bold mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Work Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ramesh@reachinternational.com"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Employment Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                  options={[
                    { value: "pending_onboarding", label: "Pending Onboarding" },
                    { value: "active", label: "Active Duty" },
                  ]}
                />
                <div>
                  <label className="block text-xs font-bold mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 35000"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  Save & Complete Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT EMPLOYEE */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedUsers size={20} className="text-sky-600" />
              Edit Employee Master Record ({selectedEmployee.employee_code})
            </h2>
            <form onSubmit={handleEditEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={designationTitle}
                    onChange={(e) => setDesignationTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Department"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  options={departments.map((d) => ({ value: d.name, label: d.name }))}
                />
                <Select
                  label="Branch Location"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  options={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.city})` }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Work Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  Update Employee Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STATUS CHANGE */}
      {showStatusModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedShieldCheck size={20} className="text-sky-600" />
              Employee Lifecycle Status Change
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Update status for <strong className="text-[var(--color-ink)]">{selectedEmployee.full_name}</strong>. Employees are never permanently deleted.
            </p>
            <form onSubmit={handleChangeStatus} className="space-y-3">
              <Select
                label="Target Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as EmployeeStatus)}
                options={[
                  { value: "active", label: "Active Duty" },
                  { value: "pending_onboarding", label: "Pending Onboarding" },
                  { value: "notice_period", label: "Notice Period" },
                  { value: "on_leave", label: "On Leave" },
                  { value: "resigned", label: "Resigned" },
                  { value: "terminated", label: "Terminated" },
                  { value: "retired", label: "Retired" },
                  { value: "inactive", label: "Inactive" },
                  { value: "archived", label: "Archived" },
                ]}
              />

              <div>
                <label className="block text-xs font-bold mb-1">Status Notes / Reason</label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="e.g. Resigned with 30-day notice served cleanly..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium h-20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  Confirm Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SALARY REVISION */}
      {showSalaryModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={20} className="text-emerald-600" />
              Add Audited Salary Revision
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Creating a revision for <strong className="text-[var(--color-ink)]">{selectedEmployee.full_name}</strong>. Preserves historical audit log.
            </p>
            <form onSubmit={handleCreateSalaryRevision} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">New Monthly Base Salary (₹) *</label>
                <input
                  type="number"
                  required
                  value={revSalary}
                  onChange={(e) => setRevSalary(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 45000"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">Fixed Component</label>
                  <input
                    type="number"
                    value={revFixed}
                    onChange={(e) => setRevFixed(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 40000"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Variable Component</label>
                  <input
                    type="number"
                    value={revVariable}
                    onChange={(e) => setRevVariable(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={revEffectiveDate}
                  onChange={(e) => setRevEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Revision Notes / Appraisal Reason</label>
                <textarea
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
                  placeholder="e.g. Annual performance increment FY 2026..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium h-16"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Record Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DEPARTMENT CREATE */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedBuilding2 size={20} className="text-sky-600" />
              Add New Department Master
            </h2>
            <form onSubmit={handleManageDepartment} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="e.g. DEP-QUALITY"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={deptTitle}
                    onChange={(e) => setDeptTitle(e.target.value)}
                    placeholder="e.g. Quality Assurance"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Description</label>
                <textarea
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Quality inspection and standards compliance unit..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium h-16"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: DESIGNATION CREATE */}
      {showDesigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedStar size={20} className="text-purple-600" />
              Add New Designation Master
            </h2>
            <form onSubmit={handleManageDesignation} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1">Code *</label>
                  <input
                    type="text"
                    required
                    value={desigCode}
                    onChange={(e) => setDesigCode(e.target.value)}
                    placeholder="e.g. DES-QA-LEAD"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={desigTitle}
                    onChange={(e) => setDesigTitle(e.target.value)}
                    placeholder="e.g. QA Lead Inspector"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>
              <Select
                label="Department"
                value={desigDeptCode}
                onChange={(e) => setDesigDeptCode(e.target.value)}
                options={departments.map((d) => ({ value: d.code, label: `${d.name} (${d.code})` }))}
              />
              <div>
                <label className="block text-xs font-bold mb-1">Description</label>
                <textarea
                  value={desigDesc}
                  onChange={(e) => setDesigDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium h-16"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDesigModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
                >
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: USER ACCOUNT REQUEST */}
      {showUserReqModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedSettings size={20} className="text-purple-600" />
              Request User Account for Employee
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Submit account creation or role request for <strong className="text-[var(--color-ink)]">{selectedEmployee.full_name}</strong> to Admin.
            </p>
            <form onSubmit={handleRequestUserAccount} className="space-y-3">
              <Select
                label="Request Type"
                value={reqType}
                onChange={(e) => setReqType(e.target.value as any)}
                options={[
                  { value: "create_account", label: "Create New System Account" },
                  { value: "deactivate_account", label: "Deactivate System Account" },
                  { value: "role_change", label: "Modify Assigned System Role" },
                ]}
              />

              <Select
                label="Requested System Role"
                value={reqRole}
                onChange={(e) => setReqRole(e.target.value as UserRole)}
                options={[
                  { value: "service_engineer", label: "Service Engineer" },
                  { value: "mechanic", label: "Mechanic" },
                  { value: "operator", label: "Operator" },
                  { value: "supervisor", label: "Supervisor" },
                  { value: "store_manager", label: "Store Manager" },
                  { value: "branch_manager", label: "Branch Manager" },
                  { value: "sales_executive", label: "Sales Executive" },
                  { value: "finance_manager", label: "Finance Manager" },
                  { value: "hr_manager", label: "HR Manager" },
                ]}
              />

              <div>
                <label className="block text-xs font-bold mb-1">Admin Notes / Justification</label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Onboarding engineer requiring access to assigned mobile app..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium h-16"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserReqModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
                >
                  Submit Request to Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: UPLOAD DOCUMENT */}
      {showDocModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={20} className="text-sky-600" />
              Attach Employee Document
            </h2>
            <p className="text-xs text-[var(--color-mute)]">
              Upload metadata for <strong className="text-[var(--color-ink)]">{selectedEmployee.full_name}</strong>.
            </p>
            <form onSubmit={handleUploadDocument} className="space-y-3">
              <Select
                label="Document Category"
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                options={[
                  { value: "joining", label: "Joining Document" },
                  { value: "identity", label: "Identity (Aadhaar/PAN/Passport)" },
                  { value: "qualification", label: "Qualification Certificate" },
                  { value: "employment", label: "Employment Agreement" },
                  { value: "offer_letter", label: "Offer Letter" },
                  { value: "appointment_letter", label: "Appointment Letter" },
                  { value: "resignation", label: "Resignation Letter" },
                  { value: "experience", label: "Experience Certificate" },
                  { value: "other", label: "Other Document" },
                ]}
              />

              <div>
                <label className="block text-xs font-bold mb-1">Document Name *</label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Aadhaar_Card_Ramesh.pdf"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">File Storage URL / Link *</label>
                <input
                  type="text"
                  required
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://docs.reachinternational.com/hr/..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  Save Attachment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
