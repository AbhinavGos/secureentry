"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const ZOHO_CPAAS_DEFAULT_ENDPOINT = "https://cpaas.zoho.com/v1.1/email";

/**
 * Dispatch an individual transactional email via Zoho CPaaS / ZeptoMail v1.1
 */
async function sendZohoCpaasEmail({
  endpoint,
  apiKey,
  fromAddress,
  fromName,
  toAddress,
  toName,
  subject,
  htmlBody,
}: {
  endpoint: string;
  apiKey: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  toName?: string;
  subject: string;
  htmlBody: string;
}) {
  const payload = {
    from: {
      address: fromAddress,
      ...(fromName ? { name: fromName } : {}),
    },
    to: [
      {
        email_address: {
          address: toAddress,
          ...(toName ? { name: toName } : {}),
        },
      },
    ],
    subject,
    htmlbody: htmlBody,
  };

  // Normalize authorization header if apiKey already includes "Zoho-enczapikey "
  const authHeader = apiKey.startsWith("Zoho-enczapikey ")
    ? apiKey
    : `Zoho-enczapikey ${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": authHeader,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let jsonResult: any = null;
  try {
    jsonResult = JSON.parse(responseText);
  } catch {
    // Non-json response
  }

  if (!response.ok) {
    const errorMsg =
      jsonResult?.message ||
      jsonResult?.error?.message ||
      `Zoho CPaaS HTTP ${response.status}: ${responseText}`;
    throw new Error(errorMsg);
  }

  return jsonResult;
}

/**
 * Action to send a single test email using Zoho CPaaS credentials.
 */
export const sendTestEmail = action({
  args: {
    toEmail: v.string(),
    toName: v.optional(v.string()),
    subject: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.ZOHO_CPAAS_API_KEY;
    const fromAddress = process.env.ZOHO_CPAAS_FROM_EMAIL || "info@digicount.ai";
    const endpoint = process.env.ZOHO_CPAAS_ENDPOINT || ZOHO_CPAAS_DEFAULT_ENDPOINT;

    if (!apiKey) {
      throw new Error(
        "ZOHO_CPAAS_API_KEY environment variable is not configured on Convex. Set it via: npx convex env set ZOHO_CPAAS_API_KEY <key>"
      );
    }

    const subject = args.subject || "Test Email from WiserStack SecureEntry";
    const htmlBody = `<div><b>Test email sent successfully via Zoho CPaaS!</b><p>Sent at: ${new Date().toISOString()}</p></div>`;

    const result = await sendZohoCpaasEmail({
      endpoint,
      apiKey,
      fromAddress,
      fromName: "SecureEntry",
      toAddress: args.toEmail,
      toName: args.toName || "Guest",
      subject,
      htmlBody,
    });

    return {
      success: true,
      result,
    };
  },
});

/**
 * Dispatch batch ticket invitations through Zoho CPaaS.
 */
export const dispatchTicketBatch = action({
  args: {
    eventId: v.id("events"),
    subject: v.string(),
    templateBody: v.string(),
    recipientCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ZOHO_CPAAS_API_KEY;
    const fromAddress = process.env.ZOHO_CPAAS_FROM_EMAIL || "info@digicount.ai";
    const endpoint = process.env.ZOHO_CPAAS_ENDPOINT || ZOHO_CPAAS_DEFAULT_ENDPOINT;

    const data: { attendees: any[]; event: any } = await ctx.runQuery(
      internal.delivery.getAttendeesForDispatch,
      {
        eventId: args.eventId,
        recipientCategory: args.recipientCategory,
      }
    );

    const { attendees, event } = data;

    if (!apiKey) {
      console.warn("ZOHO_CPAAS_API_KEY not configured. Running in simulation mode.");
      return {
        success: true,
        count: attendees.length,
        simulated: true,
        message: "Simulation mode: configured recipients resolved without external dispatch.",
      };
    }

    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    const baseUrl = process.env.VITE_APP_URL || "https://secureentry.wiserstack.com";

    for (const attendee of attendees) {
      const ticketLink = `${baseUrl}/t/${attendee.ticketCode}`;
      const fullName = `${attendee.firstName} ${attendee.lastName}`.trim();

      const personalizedBody = args.templateBody
        .replace(/\{firstName\}/g, attendee.firstName)
        .replace(/\{lastName\}/g, attendee.lastName)
        .replace(/\{eventName\}/g, event?.title || "Event")
        .replace(/\{ticketLink\}/g, ticketLink)
        .replace(/\n/g, "<br/>");

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b;">
          ${personalizedBody}
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
            Secure Entry Powered by WiserStack
          </div>
        </div>
      `;

      try {
        const sendResult = await sendZohoCpaasEmail({
          endpoint,
          apiKey,
          fromAddress,
          fromName: event?.title || "SecureEntry",
          toAddress: attendee.email,
          toName: fullName,
          subject: args.subject.replace(/\{eventName\}/g, event?.title || "Event"),
          htmlBody,
        });

        await ctx.runMutation(internal.delivery.recordDeliveryLog, {
          eventId: args.eventId,
          attendeeId: attendee._id,
          status: "SENT",
          externalMessageId: sendResult?.data?.[0]?.message_id || sendResult?.message_id,
        });

        successCount++;
      } catch (err: any) {
        failCount++;
        const errMsg = err?.message || String(err);
        errors.push({ email: attendee.email, error: errMsg });

        await ctx.runMutation(internal.delivery.recordDeliveryLog, {
          eventId: args.eventId,
          attendeeId: attendee._id,
          status: "FAILED",
          errorReason: errMsg,
        });
      }
    }

    return {
      success: failCount === 0,
      count: successCount,
      failed: failCount,
      errors: errors.slice(0, 5),
      simulated: false,
    };
  },
});

export const syncDeliveryStatusCron = action({
  args: {},
  handler: async () => {
    console.log("Checking active event delivery status...");
    return { status: "OK" };
  },
});
