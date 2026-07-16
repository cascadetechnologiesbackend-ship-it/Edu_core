import { Metadata } from "next";
import Link from "next/link";
import { IndianRupee, LayoutTemplate, Percent, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Fees Dashboard",
};

export default function FeesDashboardPage() {
  const actions = [
    {
      title: "Fee Collection",
      description: "Collect fees, generate invoices, and view payments.",
      href: "/fees/collect",
      icon: IndianRupee,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Fee Structures",
      description: "Configure fee heads, terms, and structures by class.",
      href: "/fees/structures",
      icon: LayoutTemplate,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Concessions",
      description: "Manage fee concessions, scholarships, and staff discounts.",
      href: "/fees/concessions",
      icon: Percent,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Fee Reports",
      description: "View collection reports, defaulters list, and ledgers.",
      href: "/fees/reports",
      icon: FileText,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Fees Management
        </h1>
        <p className="text-gray-500 mt-1">
          Overview and quick actions for fee administration.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href as any}
            className="block group"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:border-blue-500/50 hover:shadow-md transition-all h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {action.title}
                </h3>
                <div className={`p-2 rounded-lg ${action.bgColor}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-auto leading-relaxed">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
