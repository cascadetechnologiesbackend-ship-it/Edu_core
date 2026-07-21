export async function sendSMS(mobileNumber: string, message: string) {
  const provider = process.env.SMS_PROVIDER || "TWILIO";

  if (!process.env.SMS_API_KEY && !process.env.TWILIO_ACCOUNT_SID) {
    console.warn(`[SMS Service] No API keys configured. Would have sent: "${message}" to ${mobileNumber}`);
    return true; // Fake success if not configured
  }

  try {
    if (provider === "TWILIO") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
        body: new URLSearchParams({
          To: mobileNumber,
          From: fromNumber!,
          Body: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Twilio error: ${response.statusText}`);
      }
      return true;
    } else {
      // MSG91 or other generic provider
      const response = await fetch("https://api.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: process.env.SMS_API_KEY!,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          flow_id: process.env.SMS_FLOW_ID,
          sender: process.env.SMS_SENDER_ID,
          mobiles: mobileNumber,
          var1: message, // Assuming flow uses var1 for message body
        }),
      });

      if (!response.ok) {
        throw new Error(`SMS Provider error: ${response.statusText}`);
      }
      return true;
    }
  } catch (error) {
    console.error("[SMS Service] Failed to send SMS:", error);
    return false;
  }
}
