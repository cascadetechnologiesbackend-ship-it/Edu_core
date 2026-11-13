import {
  LayoutDashboard,
  Building2,
  History,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { TourDeck, PageTourDefinition } from "./types";

export const SUPER_ADMIN_DECK: TourDeck = {
  role: "SUPER_ADMIN",
  roleDisplayName: "Platform Super Administrator",
  completionTitle: "Super Admin Platform Tour Complete!",
  completionMessage: "Multi-tenant directory, unified school provisioning, audit logs, and DPDP governance are ready.",
  modules: [
    {
      id: "sa-overview",
      tag: "Platform",
      tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      title: "Platform Command Center",
      summary: "Multi-tenant health, real-time transaction volume, and operational uptime across all school instances.",
      whatItIs: "The master operational dashboard governing the multi-tenant SaaS infrastructure.",
      whyItMatters: "Enables immediate detection of database load, latency spikes, or tenant anomalies.",
      ctaHref: "/super-admin/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-blue-400",
      bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
      subModules: [
        {
          id: "sa-health-metrics",
          title: "Tenant Operations Health",
          summary: "Monitor active school tenants, daily active users, and system delivery metrics.",
          ctaHref: "/super-admin/dashboard",
        },
      ],
    },
    {
      id: "sa-schools-mgr",
      tag: "Tenancy",
      tagColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      title: "School Tenants & Provisioning",
      summary: "Manage school instances, toggle tenant status, and provision new school tenants with unified onboarding.",
      whatItIs: "Multi-tenant school directory with cryptographic impersonation and instant 8-step school provisioning.",
      whyItMatters: "Allows rapid onboarding of new schools while preserving isolated database tenant schemas.",
      ctaHref: "/super-admin/schools",
      icon: Building2,
      iconColor: "text-indigo-400",
      bgGradient: "from-indigo-600/20 via-blue-600/10 to-transparent",
      subModules: [
        {
          id: "sa-tenant-list",
          title: "School Tenant Directory",
          summary: "Search, inspect, and manage all registered school instances across boards.",
          ctaHref: "/super-admin/schools",
        },
        {
          id: "sa-provision-wizard",
          title: "Unified School Provisioning",
          summary: "Launch the 8-step wizard to setup board curriculum, classes, fee heads, and admin credentials.",
          ctaHref: "/super-admin/schools/provision",
        },
      ],
    },
    {
      id: "sa-audit-logs",
      tag: "Compliance",
      tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      title: "Platform Audit Trail",
      summary: "Immutable, append-only audit log tracking security events, role elevations, and unauthorized access attempts.",
      whatItIs: "Platform-wide security audit journal recording all operator actions.",
      whyItMatters: "Ensures comprehensive accountability for SOC2 and regulatory compliance.",
      ctaHref: "/super-admin/audit",
      icon: History,
      iconColor: "text-amber-400",
      bgGradient: "from-amber-600/20 via-orange-600/10 to-transparent",
      subModules: [
        {
          id: "sa-audit-trail",
          title: "Immutable Security Log",
          summary: "Inspect timestamped operator actions, impersonation sessions, and route attempts.",
          ctaHref: "/super-admin/audit",
        },
      ],
    },
    {
      id: "sa-dpdp-vault",
      tag: "Data Privacy",
      tagColor: "bg-red-500/10 text-red-400 border-red-500/20",
      title: "DPDP Privacy Governance",
      summary: "Cross-tenant data fiduciary oversight ensuring compliance with India's DPDP Act 2023.",
      whatItIs: "Platform governance vault auditing parental consent forms and data deletion requests.",
      whyItMatters: "Guarantees nationwide data protection standards across all hosted educational institutions.",
      ctaHref: "/super-admin/dpdp",
      icon: ShieldCheck,
      iconColor: "text-red-400",
      bgGradient: "from-red-600/20 via-rose-600/10 to-transparent",
      subModules: [
        {
          id: "sa-dpdp-governance",
          title: "DPDP Compliance Ledger",
          summary: "Audit parental consent compliance and minor child data privacy standards.",
          ctaHref: "/super-admin/dpdp",
        },
      ],
    },
    {
      id: "sa-blueprints-mgr",
      tag: "Blueprints",
      tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      title: "Statutory Board Blueprints",
      summary: "Pre-configured canonical blueprints for CBSE, ICSE, and State Board curriculums.",
      whatItIs: "Template library establishing standard grading schemes, subjects, and exam matrices.",
      whyItMatters: "Accelerates school onboarding by automatically seeding board-compliant defaults.",
      ctaHref: "/super-admin/templates",
      icon: Layers,
      iconColor: "text-purple-400",
      bgGradient: "from-purple-600/20 via-violet-600/10 to-transparent",
      subModules: [
        {
          id: "sa-canonical-blueprints",
          title: "Board Examination Blueprints",
          summary: "Inspect and configure canonical examination templates and evaluation rules.",
          ctaHref: "/super-admin/templates",
        },
      ],
    },
  ],
};

// ============================================================================
// CONTEXTUAL PAGE TOURS (CT-L5)
// ============================================================================

export const SUPER_ADMIN_MODULE_ORDER = [
  "super-admin-command",
  "super-admin-tenants",
  "super-admin-provisioning",
];

export const SUPER_ADMIN_PAGE_TOURS: PageTourDefinition[] = [
  {
    pagePath: "/super-admin/dashboard",
    moduleId: "super-admin-command",
    moduleTitle: "Super Admin Command Center",
    steps: [
      {
        anchorId: "super-admin-metrics-grid",
        title: "Platform Metrics",
        line: "Total tenants, active schools, global pupil census, and platform revenue telemetry.",
      },
      {
        anchorId: "super-admin-provision-btn",
        title: "Provision School Instance",
        line: "Launch the 8-step idempotent school tenant onboarding wizard.",
        ctaLabel: "Provision School",
      },
    ],
  },
  {
    pagePath: "/super-admin/schools",
    moduleId: "super-admin-tenants",
    moduleTitle: "Tenant Registry & Impersonation",
    steps: [
      {
        anchorId: "super-admin-schools-table",
        title: "Tenant Registry Table",
        line: "Live listing of all registered school instances with health checks and impersonate action.",
      },
    ],
  },
  {
    pagePath: "/super-admin/provisioning/new",
    moduleId: "super-admin-provisioning",
    moduleTitle: "Unified School Provisioning Wizard",
    steps: [
      {
        anchorId: "super-admin-wizard-stepper",
        title: "8-Step Onboarding Stepper",
        line: "Board, academic term, grade range, fee cycles, and admin credentials.",
      },
    ],
  },
];

