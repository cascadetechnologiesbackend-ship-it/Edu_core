/**
 * Production DLT-Registered Indian Transactional SMS Service (AZ-01)
 *
 * Implements:
 * 1. Zero silent fake-success: Unconfigured credentials return false / { delivered: false, unconfigured: true }.
 * 2. Multi-provider Indian DLT routing (Twilio, MSG91, Fast2SMS, Generic DLT Gateway).
 * 3. 3x retry with exponential backoff for network/transient failures.
 * 4. Structured delivery status logging.
 */

export interface SmsDeliveryResult {
  delivered: boolean;
  unconfigured?: boolean;
  messageId?: string;
  attempts?: number;
  error?: string;
}

export interface DltTemplateParams {
  templateId?: string;
  entityId?: string;
  variables?: Record<string, string>;
}

export function isSmsConfigured(): boolean {
  const provider = (process.env.SMS_PROVIDER || "TWILIO").toUpperCase();
  if (provider === "TWILIO") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
  }
  return Boolean(process.env.SMS_API_KEY);
}

/**
 * Normalizes Indian mobile numbers to E.164 (+91XXXXXXXXXX)
 */
export function normalizeIndianMobile(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }
  if (raw.startsWith("+")) {
    return `+${cleaned}`;
  }
  return `+91${cleaned.slice(-10)}`;
}

/**
 * Executes a fetch request with 3x retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<{ ok: boolean; status: number; text: string; attempts: number }> {
  let lastError: Error | null = null;
  let lastStatus = 500;
  let lastText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      if (res.ok) {
        return { ok: true, status: res.status, text, attempts: attempt };
      }
      lastStatus = res.status;
      lastText = text;

      // 4xx errors (client/auth/validation) shouldn't be retried
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        break;
      }
    } catch (err: any) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      const backoffMs = 300 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  return {
    ok: false,
    status: lastStatus,
    text: lastError ? lastError.message : lastText,
    attempts: maxAttempts,
  };
}

/**
 * Core delivery engine with Indian DLT and international provider dispatch
 */
export async function sendSMSWithStatus(
  mobileNumber: string,
  message: string,
  dltParams?: DltTemplateParams
): Promise<SmsDeliveryResult> {
  const formattedMobile = normalizeIndianMobile(mobileNumber);

  if (!isSmsConfigured()) {
    console.warn(
      `[SMS Service] [UNCONFIGURED] Would have sent: "${message}" to ${formattedMobile}`
    );
    return {
      delivered: false,
      unconfigured: true,
      error: "SMS credentials not configured in environment.",
    };
  }

  const provider = (process.env.SMS_PROVIDER || "TWILIO").toUpperCase();
  const entityId = dltParams?.entityId || process.env.SMS_DLT_PE_ID || "";
  const templateId = dltParams?.templateId || process.env.SMS_DLT_TEMPLATE_ID || "";
  const senderId = process.env.SMS_SENDER_ID || "SCHMTR";

  try {
    if (provider === "TWILIO") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!;
      const authToken = process.env.TWILIO_AUTH_TOKEN!;
      const fromNumber = process.env.TWILIO_FROM_NUMBER!;

      const params = new URLSearchParams({
        To: formattedMobile,
        From: fromNumber,
        Body: message,
      });

      // Pass DLT params if Twilio India DLT routing is activated
      if (entityId) params.append("EntityId", entityId);
      if (templateId) params.append("TemplateId", templateId);

      const result = await fetchWithRetry(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          },
          body: params,
        }
      );

      if (!result.ok) {
        console.error(
          `[SMS Service] Twilio delivery failed (status=${result.status}, attempts=${result.attempts}):`,
          result.text
        );
        return {
          delivered: false,
          attempts: result.attempts,
          error: `Twilio delivery failed: HTTP ${result.status}`,
        };
      }

      let messageId: string | undefined;
      try {
        const parsed = JSON.parse(result.text);
        messageId = parsed.sid;
      } catch (_) {}

      console.info(
        `[SMS Service] [SENT] provider=TWILIO to=${formattedMobile} sid=${messageId} attempts=${result.attempts}`
      );
      return { delivered: true, messageId, attempts: result.attempts };
    } else if (provider === "MSG91") {
      const apiKey = process.env.SMS_API_KEY!;
      const flowId = templateId || process.env.SMS_FLOW_ID || "";

      const result = await fetchWithRetry("https://api.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          flow_id: flowId,
          sender: senderId,
          mobiles: formattedMobile.replace("+", ""),
          var1: message,
          ...(dltParams?.variables || {}),
        }),
      });

      if (!result.ok) {
        console.error(
          `[SMS Service] MSG91 delivery failed (status=${result.status}, attempts=${result.attempts}):`,
          result.text
        );
        return {
          delivered: false,
          attempts: result.attempts,
          error: `MSG91 error: HTTP ${result.status}`,
        };
      }

      console.info(
        `[SMS Service] [SENT] provider=MSG91 to=${formattedMobile} attempts=${result.attempts}`
      );
      return { delivered: true, attempts: result.attempts };
    } else if (provider === "FAST2SMS") {
      const apiKey = process.env.SMS_API_KEY!;
      const clean10 = formattedMobile.slice(-10);

      const result = await fetchWithRetry("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: templateId ? "dlt" : "v3",
          sender_id: senderId,
          message: templateId || message,
          flash: 0,
          numbers: clean10,
          variables_values: dltParams?.variables
            ? Object.values(dltParams.variables).join("|")
            : undefined,
        }),
      });

      if (!result.ok) {
        console.error(
          `[SMS Service] Fast2SMS delivery failed (status=${result.status}, attempts=${result.attempts}):`,
          result.text
        );
        return {
          delivered: false,
          attempts: result.attempts,
          error: `Fast2SMS error: HTTP ${result.status}`,
        };
      }

      console.info(
        `[SMS Service] [SENT] provider=FAST2SMS to=${formattedMobile} attempts=${result.attempts}`
      );
      return { delivered: true, attempts: result.attempts };
    } else {
      // Generic Indian DLT HTTP Gateway fallback
      const gatewayUrl =
        process.env.SMS_GATEWAY_URL || "https://api.sms-gateway.in/v1/send";
      const apiKey = process.env.SMS_API_KEY!;

      const result = await fetchWithRetry(gatewayUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: formattedMobile,
          message,
          sender: senderId,
          entityId,
          templateId,
        }),
      });

      if (!result.ok) {
        console.error(
          `[SMS Service] DLT Gateway delivery failed (status=${result.status}, attempts=${result.attempts}):`,
          result.text
        );
        return {
          delivered: false,
          attempts: result.attempts,
          error: `DLT Gateway error: HTTP ${result.status}`,
        };
      }

      console.info(
        `[SMS Service] [SENT] provider=DLT_INDIA to=${formattedMobile} attempts=${result.attempts}`
      );
      return { delivered: true, attempts: result.attempts };
    }
  } catch (error: any) {
    console.error("[SMS Service] Unexpected fatal delivery error:", error);
    return {
      delivered: false,
      error: error.message || "Unexpected SMS provider communication failure.",
    };
  }
}

/**
 * Standard sendSMS API with backward-compatible boolean signature.
 * Strictly returns false when unconfigured or failed (no silent fake-success).
 */
export async function sendSMS(
  mobileNumber: string,
  message: string,
  dltParams?: DltTemplateParams
): Promise<boolean> {
  const res = await sendSMSWithStatus(mobileNumber, message, dltParams);
  return res.delivered;
}

/**
 * High-level helper for DLT-registered transactional reminders / OTPs
 */
export async function sendDLTTransactionalSMS(
  mobileNumber: string,
  templateId: string,
  variables: Record<string, string>
): Promise<SmsDeliveryResult> {
  const renderedMessage = Object.entries(variables).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`{#${k}#}`, "g"), v),
    `DLT Template ${templateId}`
  );
  return sendSMSWithStatus(mobileNumber, renderedMessage, {
    templateId,
    variables,
  });
}
