"use client";

import { useState, useTransition } from "react";
import { saveGradeRules, seedCBSERules } from "./actions";

type ClassGroupValue =
  | "NURSERY_UKG"
  | "CLASS_1_5"
  | "CLASS_6_8"
  | "CLASS_9_10"
  | "CLASS_11_12";

interface GradeRule {
  id?: string;
  classGroup: ClassGroupValue;
  minPercent: number;
  maxPercent: number;
  grade: string;
  gradePoint: number;
  description: string;
}

interface GradeRulesManagerProps {
  schoolId: string;
  classGroups: ReadonlyArray<{ value: ClassGroupValue; label: string }>;
  existingRules: GradeRule[];
}

const DEFAULT_NEW_RULE: Omit<GradeRule, "classGroup"> = {
  minPercent: 0,
  maxPercent: 100,
  grade: "",
  gradePoint: 0,
  description: "",
};

export function GradeRulesManager({
  schoolId,
  classGroups,
  existingRules,
}: GradeRulesManagerProps) {
  const [activeGroup, setActiveGroup] = useState<ClassGroupValue>(
    classGroups[0]?.value || "CLASS_1_5",
  );
  const [rules, setRules] = useState<GradeRule[]>(existingRules);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const groupRules = rules.filter((r) => r.classGroup === activeGroup);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { ...DEFAULT_NEW_RULE, classGroup: activeGroup },
    ]);
  };

  const updateRule = (
    idx: number,
    field: keyof GradeRule,
    value: string | number,
  ) => {
    const globalIdx = rules.findIndex(
      (r) =>
        r.classGroup === activeGroup &&
        rules.filter((x) => x.classGroup === activeGroup).indexOf(r) === idx,
    );
    if (globalIdx === -1) return;

    setRules((prev) => {
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], [field]: value } as GradeRule;
      return next;
    });
  };

  const removeRule = (idx: number) => {
    const groupFiltered = rules.filter((r) => r.classGroup === activeGroup);
    const toRemove = groupFiltered[idx];
    setRules((prev) => prev.filter((r) => r !== toRemove));
  };

  const handleSave = () => {
    startTransition(async () => {
      setMessage("");
      const res = await saveGradeRules({
        classGroup: activeGroup,
        rules: groupRules.map((r) => ({
          minPercent: r.minPercent,
          maxPercent: r.maxPercent,
          grade: r.grade,
          gradePoint: r.gradePoint,
          description: r.description,
        })),
      });
      setMessage(
        res.success
          ? `✓ Saved ${groupRules.length} rules for ${activeGroup}`
          : `✗ ${res.message}`,
      );
    });
  };

  const handleSeedCBSE = () => {
    startTransition(async () => {
      setMessage("");
      const res = await seedCBSERules({ classGroup: activeGroup });
      if (res.success && res.rules) {
        const newGroupRules = res.rules as GradeRule[];
        setRules((prev) => [
          ...prev.filter((r) => r.classGroup !== activeGroup),
          ...newGroupRules,
        ]);
        setMessage(`✓ CBSE scale seeded for ${activeGroup}`);
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Group Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/40 border border-border/40 overflow-x-auto no-scrollbar w-fit">
        {classGroups.map((g) => (
          <button
            key={g.value}
            onClick={() => setActiveGroup(g.value)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
              activeGroup === g.value
                ? "bg-card text-[#007AFF] dark:text-[#0A84FF] shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {groupRules.length} grade boundaries configured
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSeedCBSE}
            disabled={isPending}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold border border-border/40 bg-card hover:bg-muted/40 text-foreground rounded-xl transition-all"
          >
            Seed CBSE Scale
          </button>
          <button
            onClick={addRule}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold border border-border/40 bg-muted/40 hover:bg-muted/60 text-foreground rounded-xl transition-all"
          >
            + Add Row
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-5 py-2 min-h-[40px] text-xs font-bold bg-[#007AFF] hover:bg-[#0062cc] dark:bg-[#0A84FF] dark:hover:bg-[#0071e3] text-white dark:text-black rounded-xl transition-all disabled:opacity-50 shadow-sm"
          >
            {isPending ? "Saving..." : "Save Rules"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.startsWith("✓")
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Min %</th>
              <th className="px-4 py-3 text-left">Max %</th>
              <th className="px-4 py-3 text-left">Grade</th>
              <th className="px-4 py-3 text-left">Grade Point</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {groupRules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No rules yet. Click &quot;Seed CBSE Scale&quot; or &quot;Add
                  Row&quot;.
                </td>
              </tr>
            )}
            {groupRules.map((rule, idx) => (
              <tr
                key={idx}
                className="hover:bg-muted/40"
              >
                {(["minPercent", "maxPercent", "gradePoint"] as const).map(
                  (field) => (
                    <td key={field} className="px-4 py-2">
                      <input
                        type="number"
                        value={rule[field]}
                        onChange={(e) =>
                          updateRule(
                            idx,
                            field,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-20 rounded border border-border/60 px-2 py-1 text-xs"
                        step={field === "gradePoint" ? 0.5 : 1}
                      />
                    </td>
                  ),
                )}
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={rule.grade}
                    onChange={(e) => updateRule(idx, "grade", e.target.value)}
                    placeholder="A1"
                    className="w-16 rounded border border-border/60 px-2 py-1 text-xs uppercase"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={rule.description}
                    onChange={(e) =>
                      updateRule(idx, "description", e.target.value)
                    }
                    placeholder="Outstanding"
                    className="w-32 rounded border border-border/60 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => removeRule(idx)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
