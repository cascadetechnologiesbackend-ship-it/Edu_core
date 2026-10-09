"use client";

import React from "react";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  BookOpen,
  User,
  CalendarCheck,
  Award,
  IndianRupee,
  UserCog,
  Library,
  Bus,
  Bell,
  Package,
  Building2,
  BarChart3,
  Shield,
  ShieldCheck,
  Settings,
  GraduationCap,
  Sparkles,
  TrendingUp,
  CreditCard,
  Receipt,
  UserCheck,
  CalendarOff,
  Banknote,
  Clock,
  FileSpreadsheet,
  FileText,
  Percent,
  BadgePercent,
  RotateCcw,
  Undo2,
  CheckSquare,
  ArrowLeftRight,
  AlertCircle,
  Landmark,
  Grid3x3,
  Activity,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  UserPlus,
  Users,
  BookOpen,
  User,
  CalendarCheck,
  Award,
  IndianRupee,
  UserCog,
  Library,
  Bus,
  Bell,
  Package,
  Building2,
  BarChart3,
  Shield,
  ShieldCheck,
  Settings,
  GraduationCap,
  Sparkles,
  TrendingUp,
  CreditCard,
  Receipt,
  UserCheck,
  CalendarOff,
  Banknote,
  Clock,
  FileSpreadsheet,
  FileText,
  Percent,
  BadgePercent,
  RotateCcw,
  Undo2,
  CheckSquare,
  ArrowLeftRight,
  AlertCircle,
  Landmark,
  Grid3x3,
  Activity,
};

interface SidebarIconProps {
  name: string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export function SidebarIcon({ name, className, "aria-hidden": ariaHidden = true }: SidebarIconProps) {
  const IconComponent = ICON_MAP[name] || LayoutDashboard;
  return <IconComponent className={className} aria-hidden={ariaHidden} />;
}
