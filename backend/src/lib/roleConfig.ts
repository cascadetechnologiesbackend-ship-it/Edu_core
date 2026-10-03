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
  | "STUDENT";

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
      { label: "School Tenants", href: "/super-admin/tenants", icon: "Building2" },
      { label: "System Health & Logs", href: "/super-admin/system", icon: "Activity" },
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
      { label: "Fee Structure & Matrix", href: "/fees/structures", icon: "Receipt" },
      { label: "Fee Collection", href: "/fees/collect", icon: "CreditCard" },
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
      { label: "My Classroom", href: "/teacher/dashboard", icon: "LayoutDashboard" },
      { label: "Daily Attendance", href: "/attendance", icon: "CalendarCheck" },
      { label: "Marks & Evaluation", href: "/exams", icon: "FileSpreadsheet" },
      { label: "Class Roster", href: "/academics", icon: "BookOpen" },
    ],
  },
  ACCOUNTANT: {
    role: "ACCOUNTANT",
    displayName: "Accountant",
    defaultDashboard: "/accountant/dashboard",
    navItems: [
      { label: "Finance Dashboard", href: "/accountant/dashboard", icon: "LayoutDashboard" },
      { label: "Fee Collection", href: "/fees/collect", icon: "CreditCard" },
      { label: "Class Pricing Matrix", href: "/fees/structures", icon: "Receipt" },
      { label: "Concessions & Waivers", href: "/fees/concessions", icon: "Percent" },
      { label: "Financial Reports", href: "/fees/reports", icon: "BarChart3" },
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
      { label: "Child Overview", href: "/parent/dashboard", icon: "LayoutDashboard" },
      { label: "Fee Payment & Invoices", href: "/parent/dashboard?tab=fees", icon: "Receipt" },
      { label: "Report Cards & Grades", href: "/parent/dashboard?tab=academics", icon: "Award" },
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
};

/**
 * Helper to get role configuration by role string.
 */
export function getRoleConfig(role?: string): RoleConfig {
  const normalizedRole = (role?.toUpperCase() as UserRole) || "SCHOOL_ADMIN";
  return ROLE_CONFIGS[normalizedRole] || ROLE_CONFIGS.SCHOOL_ADMIN;
}
