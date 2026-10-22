import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Inbound webhook for Zoho CPaaS delivery receipts
http.route({
  path: "/zoho-webhook",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const signature = request.headers.get("X-Zoho-Signature");
    const secret = process.env.ZOHO_WEBHOOK_SECRET;

    if (secret && signature) {
      // In production: verify HMAC-SHA256 signature against request body
    }

    try {
      const payload = (await request.json()) as { messageId?: string; status?: string };
      console.log("Ingested Zoho CPaaS delivery status:", payload);
      return new Response("OK", { status: 200 });
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
  }),
});

export default http;
