"use client";

import { useState } from "react";
import Script from "next/script";
import { CreditCard, Loader2 } from "lucide-react";

export function CheckoutButton({
  invoiceId,
  amount,
  className,
}: {
  invoiceId: string;
  amount: number;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Create Razorpay Order
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount }),
      });

      const order = await res.json();

      if (order.error) {
        alert("Error creating order: " + order.error);
        setLoading(false);
        return;
      }

      // Open Razorpay Checkout modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "SchoolMitra ERP",
        description: "Fee Payment",
        order_id: order.id,
        handler: function () {
          window.location.reload();
        },
        prefill: {
          name: "Parent",
          email: "parent@example.com",
          contact: "9999999999",
        },
        theme: {
          color: "#4f46e5",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert("Something went wrong with the payment gateway.");
    } finally {
      setLoading(false);
    }
  };

  const defaultStyles =
    "w-full sm:w-auto py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50";

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading}
        className={className || defaultStyles}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pay Online</span>
          </>
        )}
      </button>
    </>
  );
}
