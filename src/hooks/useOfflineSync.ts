import { useEffect, useState, useCallback, useRef } from "react";
import { localDb, LocalAttendee } from "../lib/db";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export interface ScanEvaluationResult {
  status: "ADMITTED" | "ALREADY_CHECKED_IN" | "INVALID_PASS" | "SESSION_RESTRICTED" | "COLLISION";
  category?: string;
  passId?: string;
  message?: string;
  isOffline?: boolean;
}

export function useOfflineSync(
  eventId: Id<"events"> | null,
  sessionId: Id<"eventSessions"> | null,
  gateId: string,
  operatorName: string
) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  // 1. Fetch sanitized roster from Convex
  const serverRoster = useQuery(
    api.attendees.getSanitizedGateRoster,
    eventId ? { eventId } : "skip"
  );

  const recordCheckInMutation = useMutation(api.checkIns.recordCheckIn);

  // 2. Hydrate local Dexie database when server roster loads
  useEffect(() => {
    if (!serverRoster || serverRoster.length === 0) return;

    const hydrateLocal = async () => {
      try {
        const localItems: LocalAttendee[] = serverRoster.map((item: any) => ({
          ticketCode: item.ticketCode,
          attendeeId: item.attendeeId,
          category: item.category,
          allowedSessionIds: item.allowedSessionIds,
          checkedInSessionIds: item.checkedInSessionIds,
          checkInStatus: item.checkInStatus,
        }));

        await localDb.attendees.bulkPut(localItems);
      } catch (err) {
        console.warn("Failed to hydrate local Dexie store:", err);
      }
    };

    void hydrateLocal();
  }, [serverRoster]);

  // 3. Update pending queue count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await localDb.checkInQueue.count();
      setPendingCount(count);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  // 4. Background replay queue worker
  const drainQueue = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine || !eventId || !sessionId) return;
    isSyncingRef.current = true;

    try {
      const pending = await localDb.checkInQueue.toArray();
      for (const item of pending) {
        try {
          await recordCheckInMutation({
            eventId: item.eventId as Id<"events">,
            sessionId: item.sessionId as Id<"eventSessions">,
            ticketCode: item.ticketCode,
            gateId: item.gateId,
            operatorId: item.operatorId,
            operatorName: item.operatorName,
            clientCapturedAt: item.clientCapturedAt,
            source: item.source,
            isOfflineSync: true,
          });

          if (item.localId !== undefined) {
            await localDb.checkInQueue.delete(item.localId);
          }
        } catch (err) {
          console.error("Failed to sync item from queue:", err);
        }
      }
    } finally {
      isSyncingRef.current = false;
      await refreshPendingCount();
    }
  }, [eventId, sessionId, recordCheckInMutation, refreshPendingCount]);

  // 5. Network listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void drainQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [drainQueue]);

  // 6. Unified evaluateScan function
  const evaluateScan = useCallback(
    async (
      ticketCode: string,
      source: "SCANNER_HID" | "CAMERA" | "MANUAL" = "SCANNER_HID"
    ): Promise<ScanEvaluationResult> => {
      if (!eventId || !sessionId) {
        return {
          status: "INVALID_PASS",
          message: "Gate terminal not initialized with an event and session.",
        };
      }

      const cleanCode = ticketCode.trim();

      // Check local cache first to get attendee metadata
      const localRecord = await localDb.attendees
        .where("ticketCode")
        .equals(cleanCode)
        .first();

      if (!localRecord) {
        return {
          status: "INVALID_PASS",
          message: "Pass not found or invalid token.",
        };
      }

      // Check session restriction
      if (
        localRecord.allowedSessionIds &&
        localRecord.allowedSessionIds.length > 0 &&
        !localRecord.allowedSessionIds.includes(sessionId)
      ) {
        return {
          status: "SESSION_RESTRICTED",
          category: localRecord.category,
          passId: cleanCode,
          message: "Pass is not authorized for this room.",
        };
      }

      // Check local duplicate in checkedInSessionIds or pending queue
      const alreadyCheckedInLocally = localRecord.checkedInSessionIds?.includes(sessionId);
      if (alreadyCheckedInLocally) {
        return {
          status: "ALREADY_CHECKED_IN",
          category: localRecord.category,
          passId: cleanCode,
          message: "Already scanned at this station.",
        };
      }

      const queueCheck = await localDb.checkInQueue
        .where("ticketCode")
        .equals(cleanCode)
        .first();
      if (queueCheck && queueCheck.sessionId === sessionId) {
        return {
          status: "ALREADY_CHECKED_IN",
          category: localRecord.category,
          passId: cleanCode,
          message: "Already scanned and queued for sync.",
        };
      }

      const clientCapturedAt = Date.now();

      // If online, attempt direct atomic mutation to Convex with a timeout
      if (navigator.onLine) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("TIMEOUT")), 350)
          );

          const result = (await Promise.race([
            recordCheckInMutation({
              eventId,
              sessionId,
              ticketCode: cleanCode,
              gateId,
              operatorId: gateId,
              operatorName,
              clientCapturedAt,
              source,
              isOfflineSync: false,
            }),
            timeoutPromise,
          ])) as { status: string; category?: string };

          // Update local record
          localRecord.checkedInSessionIds = [
            ...(localRecord.checkedInSessionIds ?? []),
            sessionId,
          ];
          localRecord.checkInStatus = "CHECKED_IN";
          await localDb.attendees.put(localRecord);

          return {
            status: "ADMITTED",
            category: result.category ?? localRecord.category,
            passId: cleanCode,
            isOffline: false,
          };
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);

          if (errorMessage.includes("ALREADY_CHECKED_IN")) {
            return {
              status: "ALREADY_CHECKED_IN",
              category: localRecord.category,
              passId: cleanCode,
              message: errorMessage.replace("Error: ", ""),
              isOffline: false,
            };
          }

          // If timeout or network failure, fall back to offline enqueueing
          console.warn("Online check-in timed out or failed, falling back to local queue:", err);
        }
      }

      // Offline fallback: Admit locally and enqueue into Dexie
      localRecord.checkedInSessionIds = [
        ...(localRecord.checkedInSessionIds ?? []),
        sessionId,
      ];
      localRecord.checkInStatus = "CHECKED_IN";
      await localDb.attendees.put(localRecord);

      await localDb.checkInQueue.add({
        eventId,
        sessionId,
        attendeeId: localRecord.attendeeId,
        ticketCode: cleanCode,
        gateId,
        operatorId: gateId,
        operatorName,
        clientCapturedAt,
        source,
        syncStatus: "PENDING",
      });

      await refreshPendingCount();

      return {
        status: "ADMITTED",
        category: localRecord.category,
        passId: cleanCode,
        isOffline: true,
      };
    },
    [eventId, sessionId, gateId, operatorName, recordCheckInMutation, refreshPendingCount]
  );

  return {
    isOnline,
    pendingCount,
    evaluateScan,
    drainQueue,
  };
}
