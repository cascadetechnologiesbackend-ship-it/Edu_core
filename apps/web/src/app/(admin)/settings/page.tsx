import Link from "next/link";
import { Settings, Award, Percent, Building2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings Dashboard | SchoolMitra ERP",
};

const SETTINGS_CARDS = [
  {
    title: "School Profile Setup",
    description: "Manage school name, address, logo, principal credentials, and basic details.",
    href: "/settings/school-setup",
    icon: Building2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Exam Types & Weightages",
    description: "Define exam types (Unit Tests, Half-Yearly, Board Exams) and weightages.",
    href: "/settings/exam-types",
    icon: Award,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Grading Configuration",
    description: "Setup percentages boundaries, letter grades, GPAs, and class group mappings.",
    href: "/settings/grading",
    icon: Percent,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
] as const;

export default function SettingsDashboardPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Settings Dashboard
        </h1>
        <p className="text-sm text-gray-500">Configure core school setups, parameters, and grading rules.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {SETTINGS_CARDS.map((card) => (
          <Link key={card.href} href={card.href as any} className="block group">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm hover:border-indigo-500/50 hover:shadow-md transition-all h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {card.title}
                </h3>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
