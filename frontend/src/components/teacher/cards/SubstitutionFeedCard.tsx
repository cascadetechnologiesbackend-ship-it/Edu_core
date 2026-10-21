"use client";

import React, { useState } from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface SubstitutionFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
  onAccept?: ((substitutionId: string) => Promise<void>) | undefined;
  onDecline?: ((substitutionId: string) => Promise<void>) | undefined;
}

export function SubstitutionFeedCard({
  card,
  locale = "en",
  onAccept,
  onDecline,
}: SubstitutionFeedCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const payload = card.payload || {};
  const isIncoming = !!payload.isIncoming;
  const hasConflict = !!payload.hasConflict;
  const topSub = payload.topSubstitution;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const handleAccept = async () => {
    if (!topSub?.id) return;
    setLoading(true);
    try {
      if (onAccept) {
        await onAccept(topSub.id);
      } else {
        const res = await fetch(`/api/teacher/substitutions/${topSub.id}/accept`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to accept");
      }
      toast.success(
        locale === "hi"
          ? "स्थानापन्न पीरियड स्वीकार कर लिया गया है"
          : "Cover period accepted and added to your schedule"
      );
      router.refresh();
    } catch {
      toast.error(
        locale === "hi" ? "स्वीकार करने में विफल" : "Failed to accept substitution"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!topSub?.id) return;
    setLoading(true);
    try {
      if (onDecline) {
        await onDecline(topSub.id);
      } else {
        const res = await fetch(`/api/teacher/substitutions/${topSub.id}/decline`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to decline");
      }
      toast.info(
        locale === "hi"
          ? "अनुरोध अस्वीकार किया गया। व्यवस्थापक को सूचित कर दिया गया है।"
          : "Request declined. Administrator has been notified."
      );
      router.refresh();
    } catch {
      toast.error(
        locale === "hi" ? "अस्वीकार करने में विफल" : "Failed to decline substitution"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="SubstitutionCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity={hasConflict ? "AMBER" : "NORMAL"}
      countdownChip={
        hasConflict
          ? locale === "hi" ? "समय टकराव" : "Schedule Conflict"
          : undefined
      }
      primaryAction={
        isIncoming
          ? {
              label: loading
                ? locale === "hi" ? "प्रसंस्करण..." : "Processing..."
                : locale === "hi" ? "कवर स्वीकार करें" : "Accept Cover",
              onClick: handleAccept,
            }
          : {
              label: locale === "hi" ? "कक्षाएं देखें" : "View Classes",
              onClick: () => router.push("/teacher/classes"),
            }
      }
      secondaryAction={
        isIncoming
          ? {
              label: locale === "hi" ? "अस्वीकार करें" : "Decline",
              onClick: handleDecline,
            }
          : undefined
      }
    >
      {hasConflict && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            {locale === "hi"
              ? "यह अवधि आपकी मौजूदा कक्षा के साथ टकरा सकती है। कृपया समय सारिणी की जांच करें।"
              : "This period may overlap with one of your assigned periods. Please check your timetable."}
          </span>
        </div>
      )}
    </TeacherFeedCard>
  );
}

export default SubstitutionFeedCard;
