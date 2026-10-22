/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendees from "../attendees.js";
import type * as auth from "../auth.js";
import type * as checkIns from "../checkIns.js";
import type * as crons from "../crons.js";
import type * as delivery from "../delivery.js";
import type * as eventSessions from "../eventSessions.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as inviters from "../inviters.js";
import type * as seed from "../seed.js";
import type * as zoho from "../zoho.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendees: typeof attendees;
  auth: typeof auth;
  checkIns: typeof checkIns;
  crons: typeof crons;
  delivery: typeof delivery;
  eventSessions: typeof eventSessions;
  events: typeof events;
  http: typeof http;
  inviters: typeof inviters;
  seed: typeof seed;
  zoho: typeof zoho;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
