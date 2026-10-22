import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Schedule delivery receipt polling every 15 minutes
crons.interval(
  "poll-zoho-delivery-receipts",
  { minutes: 15 },
  api.zoho.syncDeliveryStatusCron
);

export default crons;
