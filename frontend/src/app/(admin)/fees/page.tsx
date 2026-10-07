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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/20">
            Enterprise Suite Active
          </span>
          <h2 className="text-xl font-bold tracking-tight mt-2">
            Multi-Layer Finance & Accounting Suite
          </h2>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Access the complete counter collection engine, challan batches, ledger reconciliation, non-fee income/expense vouchers, and financial dashboards.
          </p>
        </div>
        <Link
          href="/school/fees-dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-600 font-bold text-xs hover:bg-blue-50 transition shadow-sm"
        >
          Open Finance Hub &rarr;
        </Link>
      </div>

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
