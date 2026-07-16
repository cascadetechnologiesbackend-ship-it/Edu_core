"use client";

import { useState } from "react";
import Script from "next/script";

export function CheckoutButton({ invoiceId, amount }: { invoiceId: string, amount: number }) {
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

      if (order.id && order.id.startsWith("order_mock_")) {
        // Mock flow
        alert("Mock payment flow detected! Keys are not configured. Marking as paid...");
        
        // Directly trigger webhook manually for mock testing (in reality, webhook comes from Razorpay backend)
        await fetch("/api/webhooks/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-razorpay-signature": "mock" },
          body: JSON.stringify({
            event: "payment.captured",
            payload: {
              payment: {
                entity: {
                  id: `pay_mock_${Date.now()}`,
                  order_id: order.id,
                  amount: order.amount,
                }
              }
            }
          }),
        });

        window.location.reload();
        return;
      }

      // Initialize Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Use NEXT_PUBLIC key
        amount: order.amount,
        currency: order.currency,
        name: "SchoolMitra ERP",
        description: "Fee Payment",
        order_id: order.id,
        handler: function () {
          // Webhook handles the actual database updates, but we can optimistically reload
          window.location.reload();
        },
        prefill: {
          name: "Parent", // In real app, fetch from session
          email: "parent@example.com",
          contact: "9999999999"
        },
        theme: {
          color: "#2563EB"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <button 
        onClick={handlePayment} 
        disabled={loading}
        className="bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Pay Online"}
      </button>
    </>
  );
}
