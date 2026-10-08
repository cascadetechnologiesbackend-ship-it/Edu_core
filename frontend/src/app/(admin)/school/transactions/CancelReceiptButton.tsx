"use client";

import { useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { cancelTransaction } from "./actions";

interface CancelReceiptButtonProps {
  paymentId: string;
  receiptNumber: string;
}

export default function CancelReceiptButton({
  paymentId,
  receiptNumber,
}: CancelReceiptButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    if (
      !confirm(
        `Are you sure you want to cancel and reverse Receipt #${receiptNumber}? This will restore the student's dues.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("paymentId", paymentId);
      formData.set("reason", "Cancelled by administrator");
      const res = await cancelTransaction(formData);
      if (!res.success) {
        alert(res.message || "Failed to cancel transaction");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={isPending}
      className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-red-50 text-gray-400 hover:text-red-600 transition disabled:opacity-50"
      title="Cancel & Reverse Receipt"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
      ) : (
        <Ban className="w-4 h-4" />
      )}
    </button>
  );
}
