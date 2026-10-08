/**
 * Role-Based Access Control (RBAC) & Navigation Configuration
 * Defines dashboard landing paths and menu navigation structures for all 10 ERP roles.
 */

export type UserRole =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "PRINCIPAL"
  | "HR_MANAGER"
  | "TEACHER"
  | "ACCOUNTANT"
  | "LIBRARIAN"
  | "TRANSPORT_MANAGER"
  | "PARENT"
  | "STUDENT"
  | "DRIVER";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface RoleConfig {
  role: UserRole;
  displayName: string;
  defaultDashboard: string;
  navItems: NavItem[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  SUPER_ADMIN: {
    role: "SUPER_ADMIN",
    displayName: "Super Admin",
    defaultDashboard: "/super-admin/dashboard",
    navItems: [
      { label: "Platform Overview", href: "/super-admin/dashboard", icon: "LayoutDashboard" },
      { label: "School Tenants", href: "/super-admin/schools", icon: "Building2" },
      { label: "System Health & Logs", href: "/super-admin/audit", icon: "Activity" },
      { label: "DPDP Governance", href: "/dpdp", icon: "ShieldCheck" },
    ],
  },
  SCHOOL_ADMIN: {
    role: "SCHOOL_ADMIN",
    displayName: "School Administrator",
    defaultDashboard: "/dashboard",
    navItems: [
      { label: "Command Center", href: "/dashboard", icon: "LayoutDashboard" },
      { label: "Admissions & Intake", href: "/admissions", icon: "UserPlus" },
      { label: "Student Information", href: "/students", icon: "Users" },
      { label: "Academics & Classes", href: "/academics", icon: "GraduationCap" },
      { label: "Fee Structure & Matrix", href: "/school/fee-structures", icon: "Receipt" },
      { label: "Fee Collection", href: "/school/collect-fees", icon: "CreditCard" },
      { label: "HR & Staff Management", href: "/hr", icon: "UserCheck" },
      { label: "Exams & Evaluation", href: "/exams", icon: "Award" },
      { label: "Attendance Control", href: "/attendance", icon: "CalendarCheck" },
      { label: "Transport Operations", href: "/transport", icon: "Bus" },
      { label: "Library Catalog", href: "/library", icon: "BookOpen" },
      { label: "DPDP Compliance", href: "/dpdp", icon: "ShieldCheck" },
      { label: "School Settings", href: "/settings", icon: "Settings" },
    ],
  },
  PRINCIPAL: {
    role: "PRINCIPAL",
    displayName: "Principal",
    defaultDashboard: "/principal/dashboard",
    navItems: [
      { label: "Academic Oversight", href: "/principal/dashboard", icon: "LayoutDashboard" },
      { label: "Class & Subject Hub", href: "/academics", icon: "GraduationCap" },
      { label: "Teacher Evaluations", href: "/hr", icon: "UserCheck" },
      { label: "Exam Approvals", href: "/exams", icon: "Award" },
      { label: "Attendance Insights", href: "/attendance", icon: "CalendarCheck" },
      { label: "Admissions Review", href: "/admissions", icon: "UserPlus" },
    ],
  },
  HR_MANAGER: {
    role: "HR_MANAGER",
    displayName: "HR & Payroll Manager",
    defaultDashboard: "/hr/dashboard",
    navItems: [
      { label: "HR Dashboard", href: "/hr/dashboard", icon: "LayoutDashboard" },
      { label: "Staff Directory", href: "/hr", icon: "Users" },
      { label: "Leave Approvals", href: "/hr?tab=leaves", icon: "CalendarOff" },
      { label: "Payroll & ECR Export", href: "/hr?tab=payroll", icon: "Banknote" },
      { label: "Staff Attendance", href: "/attendance?tab=staff", icon: "Clock" },
    ],
  },
  TEACHER: {
    role: "TEACHER",
    displayName: "Educator / Teacher",
    defaultDashboard: "/teacher/dashboard",
    navItems: [
      { label: "My Hub", href: "/teacher/dashboard", icon: "LayoutDashboard" },
      { label: "Attendance", href: "/teacher/attendance", icon: "CalendarCheck" },
      { label: "Gradebook", href: "/teacher/grading", icon: "FileSpreadsheet" },
      { label: "My Classes", href: "/teacher/classes", icon: "BookOpen" },
    ],
  },
  ACCOUNTANT: {
    role: "ACCOUNTANT",
    displayName: "Accountant",
    defaultDashboard: "/school/fees-dashboard",
    navItems: [
      { label: "Finance Hub", href: "/school/fees-dashboard", icon: "TrendingUp" },
      { label: "Collect Fee", href: "/school/collect-fees", icon: "CreditCard" },
      { label: "Dues Work List", href: "/school/due-fees", icon: "FileText" },
      { label: "Day Book", href: "/school/transactions", icon: "Receipt" },
      { label: "Accounts Hub", href: "/school/accounting/dashboard", icon: "Building2" },
      { label: "Discounts & Concessions", href: "/school/fees-discount", icon: "Percent" },
      { label: "Refunds", href: "/school/refunds", icon: "RotateCcw" },
      { label: "Concession Summary", href: "/school/accounting/reports/concessions", icon: "BarChart3" },
      { label: "BRS Preview", href: "/school/accounts/bank-reconciliation", icon: "CheckSquare" },
      { label: "Pricing Matrix", href: "/school/fee-structures", icon: "Receipt" },
    ],
  },
  LIBRARIAN: {
    role: "LIBRARIAN",
    displayName: "Librarian",
    defaultDashboard: "/librarian/dashboard",
    navItems: [
      { label: "Library Dashboard", href: "/librarian/dashboard", icon: "LayoutDashboard" },
      { label: "Book Catalog", href: "/library", icon: "BookOpen" },
      { label: "Issue & Return Log", href: "/library?tab=issues", icon: "ArrowLeftRight" },
      { label: "Overdue Fines", href: "/library?tab=fines", icon: "AlertCircle" },
    ],
  },
  TRANSPORT_MANAGER: {
    role: "TRANSPORT_MANAGER",
    displayName: "Transport Operations",
    defaultDashboard: "/transport/dashboard",
    navItems: [
      { label: "Transport Dashboard", href: "/transport/dashboard", icon: "LayoutDashboard" },
      { label: "Bus Routes & Stops", href: "/transport", icon: "Bus" },
      { label: "Student Allocations", href: "/transport?tab=allocations", icon: "Users" },
    ],
  },
  PARENT: {
    role: "PARENT",
    displayName: "Parent / Guardian",
    defaultDashboard: "/parent/dashboard",
    navItems: [
      { label: "Overview", href: "/parent/dashboard", icon: "LayoutDashboard" },
      { label: "Attendance", href: "/parent/attendance", icon: "CalendarCheck" },
      { label: "Fee Portal", href: "/parent/fees", icon: "Receipt" },
      { label: "Bus Tracker", href: "/parent/bus", icon: "Bus" },
    ],
  },
  STUDENT: {
    role: "STUDENT",
    displayName: "Student",
    defaultDashboard: "/student/dashboard",
    navItems: [
      { label: "Student Hub", href: "/student/dashboard", icon: "LayoutDashboard" },
      { label: "Timetable & Classes", href: "/student/dashboard?tab=timetable", icon: "Calendar" },
      { label: "My Report Cards", href: "/student/dashboard?tab=grades", icon: "Award" },
    ],
  },
  DRIVER: {
    role: "DRIVER",
    displayName: "Bus Driver",
    defaultDashboard: "/driver/dashboard",
    navItems: [
      { label: "My Route & Trip", href: "/driver/dashboard", icon: "Map" },
      { label: "GPS Broadcast", href: "/driver/dashboard?tab=gps", icon: "Navigation" },
      { label: "Profile & Settings", href: "/driver/profile", icon: "User" },
    ],
  },
};

/**
 * Helper to get role configuration by role string.
 */
export function getRoleConfig(role?: string): RoleConfig {
  const normalizedRole = (role?.toUpperCase() as UserRole) || "SCHOOL_ADMIN";
  return ROLE_CONFIGS[normalizedRole] || ROLE_CONFIGS.SCHOOL_ADMIN;
}

export interface PermissionMatrixRow {
  module: string;
  action: string;
  description: string;
  allowedRoles: UserRole[];
}

export const BASELINE_PERMISSION_MATRIX: PermissionMatrixRow[] = [
  {
    module: "Finance & Fee Collection",
    action: "View Finance Hub & Dashboards",
    description: "Access fee summary KPIs, collection graphs, and overdue lists",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"],
  },
  {
    module: "Finance & Fee Collection",
    action: "Collect Fees & Generate Receipts",
    description: "Counter collection, payment mode recording, fee challan settlements",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  },
  {
    module: "Finance & Fee Collection",
    action: "Fee Structure Management",
    description: "Define fee heads, groups, annual fee matrices, and term slabs",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  },
  {
    module: "Finance & Accounts",
    action: "Transaction Cancellation & Split Reversal",
    description: "Cancel settled receipts and issue mirror ledger split reversals",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    module: "Accounting & Vouchers",
    action: "Journal Voucher (JV) & Contra Create",
    description: "Post manual double-entry adjustments and cash-bank contra entries",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    module: "Accounting & Banking",
    action: "Bank Reconciliation (BRS) Adjusting JV",
    description: "Import bank statements, match transactions, and post adjusting JVs",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    module: "Financial Reporting",
    action: "Statements View (Trial Balance, P&L, BS)",
    description: "View financial reports with discrepancy indicators",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
  },
  {
    module: "Financial Reporting",
    action: "Statements Export (XLSX)",
    description: "Download verified trial balances and financial statements",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    module: "Financial Reporting",
    action: "Concession & Waiver Summary Report",
    description: "View revenue foregone grouped by Policy x Term x Class",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"],
  },
  {
    module: "Finance Governance",
    action: "Academic Year Fiscal Lock / Unlock",
    description: "Enforce ledger immutability and lock backdated fiscal periods",
    allowedRoles: ["SUPER_ADMIN"],
  },
  {
    module: "HR & Staff Management",
    action: "Staff Onboarding & Directory",
    description: "Onboard teaching & non-teaching staff with authoritative roles",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER", "PRINCIPAL"],
  },
  {
    module: "RBAC & Security",
    action: "Assign / Remove User Roles & Access Toggle",
    description: "Manage user account status, credentials reset, and role memberships",
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    module: "RBAC & Security",
    action: "System Role Definition CRUD",
    description: "Define custom role permissions and platform-level schemas",
    allowedRoles: ["SUPER_ADMIN"],
  },
];
