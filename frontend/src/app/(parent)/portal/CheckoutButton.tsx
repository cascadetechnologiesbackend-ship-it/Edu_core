"use client";

import { useState } from "react";
import Script from "next/script";
import { CreditCard, Loader2, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

export interface RazorpayPaymentSuccessData {
  paymentId: string;
  receiptNumber: string;
  downloadUrl?: string;
}

export interface RazorpayPaymentButtonProps {
  invoiceId: string;
  amount: number;
  studentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  className?: string;
  label?: string;
  onSuccess?: (data: RazorpayPaymentSuccessData) => void;
}

export function CheckoutButton({
  invoiceId,
  amount,
  studentName,
  parentEmail,
  parentPhone,
  className,
  label = "Pay Online",
  onSuccess,
}: RazorpayPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const handlePayment = async () => {
    if (amount <= 0) {
      toast.error("Invalid payment amount.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create Razorpay Order
      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount }),
      });

      const order = await res.json();

      if (!res.ok || order.error) {
        toast.error("Error creating payment order: " + (order.error || "Unknown"));
        setLoading(false);
        return;
      }

      // 2. Configure Razorpay modal
      const keyId =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TlW4pDX3FlFmRx";

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "SchoolMitra ERP",
        description: `Fee Settlement - ${order.receipt || invoiceId}`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            setLoading(true);
            toast.loading("Verifying payment signature with bank gateway...", { id: "rzp-verify" });

            // 3. Client signature verification
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            toast.dismiss("rzp-verify");

            if (verifyRes.ok && verifyData.success) {
              toast.success(`Payment verified! Receipt: ${verifyData.receiptNumber}`);
              if (verifyData.downloadUrl) {
                setReceiptUrl(verifyData.downloadUrl);
              }

              if (onSuccess) {
                onSuccess(verifyData);
              } else {
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              }
            } else {
              toast.error(
                "Payment verification failed: " +
                  (verifyData.error || "Please contact school cashier.")
              );
            }
          } catch (verifyErr: any) {
            toast.dismiss("rzp-verify");
            toast.error("Verification connection error: " + verifyErr.message);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: studentName || "Parent / Student",
          email: parentEmail || "parent@schoolmitra.in",
          contact: parentPhone || "9999999999",
        },
        theme: {
          color: "#4f46e5",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast.info("Payment checkout cancelled.");
          },
        },
      };

      if (typeof window !== "undefined" && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        toast.error("Payment SDK is loading, please try again in a moment.");
        setLoading(false);
      }
    } catch (err: any) {
      toast.error("Gateway error: " + (err.message || "Could not connect to payment server"));
      setLoading(false);
    }
  };

  const defaultStyles =
    "w-full sm:w-auto py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50";

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Receipt Download</span>
          <Download className="w-3.5 h-3.5 ml-1" />
        </a>
      ) : (
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
              <span>{label}</span>
            </>
          )}
        </button>
      )}
    </>
  );
}

// Universal export
export const RazorpayPaymentButton = CheckoutButton;
