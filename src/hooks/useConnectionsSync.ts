"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useChatStore } from "@/store/useChatStore";

const REFRESH_BATCH_MS = 180;

type ConnectionStatus = "pending" | "accepted" | string;

type ConnectionRow = {
  requester_id: string;
  receiver_id: string;
  status: ConnectionStatus;
};

type RefreshTargets = {
  contacts: boolean;
  requests: boolean;
};

function asConnectionRow(value: unknown): Partial<ConnectionRow> | null {
  if (!value || typeof value !== "object") return null;
  return value as Partial<ConnectionRow>;
}

function shouldRefreshContacts(
  row: Partial<ConnectionRow> | null,
  currentUserId: string
) {
  if (!row || row.status !== "accepted") return false;
  return (
    row.requester_id === currentUserId || row.receiver_id === currentUserId
  );
}

function shouldRefreshRequests(
  row: Partial<ConnectionRow> | null,
  currentUserId: string
) {
  if (!row || row.status !== "pending") return false;
  return row.receiver_id === currentUserId;
}

function getRefreshTargets(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  currentUserId: string
): RefreshTargets {
  const oldRow = asConnectionRow(payload.old);
  const newRow = asConnectionRow(payload.new);

  switch (payload.eventType) {
    case "INSERT":
      return {
        contacts: shouldRefreshContacts(newRow, currentUserId),
        requests: shouldRefreshRequests(newRow, currentUserId),
      };
    case "UPDATE":
      return {
        contacts:
          shouldRefreshContacts(oldRow, currentUserId) ||
          shouldRefreshContacts(newRow, currentUserId),
        requests:
          shouldRefreshRequests(oldRow, currentUserId) ||
          shouldRefreshRequests(newRow, currentUserId),
      };
    case "DELETE":
      // If we don't have the full row payload, assume it could be our contact and force refresh.
      // This is a safe fallback for postgres 'DELETE' events that only return the id.
      if (!oldRow || !oldRow.status) {
         return { contacts: true, requests: true };
      }
      return {
        contacts: shouldRefreshContacts(oldRow, currentUserId),
        requests: shouldRefreshRequests(oldRow, currentUserId),
      };
    default:
      // Fallback for safety if supabase introduces another event type.
      return { contacts: true, requests: true };
  }
}

/**
 * Centralized connections sync:
 * - Subscribes once (requester + receiver scoped filters)
 * - Batches frequent realtime events
 * - Refreshes only the state slices affected by each row change
 * - Keeps contacts and pending requests in sync
 */
export function useConnectionsSync(currentUserId: string) {
  const supabase = useMemo(() => createClient(), []);
  const hasHydrated = useChatStore((state) => state.hasHydrated);
  const fetchContacts = useChatStore((state) => state.fetchContacts);
  const fetchPendingRequests = useChatStore((state) => state.fetchPendingRequests);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedRefreshRef = useRef<RefreshTargets>({
    contacts: false,
    requests: false,
  });

  const refreshNow = useCallback(
    ({ contacts, requests }: RefreshTargets) => {
      if (!currentUserId) return;

      if (contacts) void fetchContacts(currentUserId);
      if (requests) void fetchPendingRequests(currentUserId);
    },
    [currentUserId, fetchContacts, fetchPendingRequests]
  );

  const refreshBothNow = useCallback(() => {
    if (!currentUserId) return;
    refreshNow({ contacts: true, requests: true });
  }, [currentUserId, refreshNow]);

  const flushQueuedRefresh = useCallback(() => {
    const queued = queuedRefreshRef.current;
    queuedRefreshRef.current = { contacts: false, requests: false };
    refreshNow(queued);
  }, [refreshNow]);

  const scheduleRefresh = useCallback((targets: RefreshTargets) => {
    if (!currentUserId) return;
    if (!targets.contacts && !targets.requests) return;

    if (targets.contacts) queuedRefreshRef.current.contacts = true;
    if (targets.requests) queuedRefreshRef.current.requests = true;
    if (refreshTimerRef.current) return;

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      flushQueuedRefresh();
    }, REFRESH_BATCH_MS);
  }, [currentUserId, flushQueuedRefresh]);

  useEffect(() => {
    if (!currentUserId || !hasHydrated) return;

    refreshBothNow();

    const handleConnectionChange = (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ) => {
      scheduleRefresh(getRefreshTargets(payload, currentUserId));
    };

    const channels: RealtimeChannel[] = [
      supabase
        .channel(`connections:requester:${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "connections",
            filter: `requester_id=eq.${currentUserId}`,
          },
          handleConnectionChange
        )
        .subscribe(),
      supabase
        .channel(`connections:receiver:${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "connections",
            filter: `receiver_id=eq.${currentUserId}`,
          },
          handleConnectionChange
        )
        .subscribe(),
      supabase
        .channel(`sync:${currentUserId}`)
        .on(
          "broadcast",
          { event: "refresh_connections" },
          () => {
            scheduleRefresh({ contacts: true, requests: true });
          }
        )
        .subscribe(),
    ];

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      queuedRefreshRef.current = { contacts: false, requests: false };

      channels.forEach((channel) => {
        channel.unsubscribe();
      });
    };
  }, [currentUserId, hasHydrated, refreshBothNow, scheduleRefresh, supabase]);
}
