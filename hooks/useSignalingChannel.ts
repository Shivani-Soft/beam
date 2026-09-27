"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SignalingStatus = "connecting" | "connected" | "error";

type MessageListener = (payload: unknown) => void;

/**
 * Subscribes to a Supabase Realtime broadcast channel for a given room and
 * exposes a small pub/sub API on top of it.
 *
 * NOTE (Milestone 6 TODO): Supabase Realtime channels don't require anyone to
 * "own" or pre-create a room. Subscribing to `room-<id>` always succeeds even
 * if no one else has ever joined that room, so an invalid/made-up room ID
 * looks identical to a valid empty one. Real room-existence validation (e.g.
 * a `rooms` table checked before subscribing, or Presence to detect whether
 * the sender is actually there) is out of scope for this milestone.
 */
export function useSignalingChannel(roomId: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listenersRef = useRef<Map<string, Set<MessageListener>>>(new Map());
  const closingRef = useRef(false);
  const [status, setStatus] = useState<SignalingStatus>("connecting");

  // Reset to "connecting" as soon as roomId changes, without a setState-in-effect
  // (see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [trackedRoomId, setTrackedRoomId] = useState(roomId);
  if (roomId !== trackedRoomId) {
    setTrackedRoomId(roomId);
    setStatus("connecting");
  }

  useEffect(() => {
    if (!roomId) return;

    closingRef.current = false;

    const channel = supabase.channel(`room-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on(
      "broadcast",
      { event: "*" },
      ({ event, payload }: { event: string; payload: unknown }) => {
        listenersRef.current.get(event)?.forEach((callback) => callback(payload));
      }
    );

    channel.subscribe((subscribeStatus) => {
      if (closingRef.current) return;

      if (subscribeStatus === "SUBSCRIBED") {
        setStatus("connected");
      } else if (
        subscribeStatus === "CHANNEL_ERROR" ||
        subscribeStatus === "TIMED_OUT" ||
        subscribeStatus === "CLOSED"
      ) {
        setStatus("error");
      }
    });

    channelRef.current = channel;

    return () => {
      closingRef.current = true;
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  const sendMessage = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const onMessage = useCallback((event: string, callback: MessageListener) => {
    const listeners = listenersRef.current;
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(callback);

    return () => {
      listeners.get(event)?.delete(callback);
    };
  }, []);

  const disconnect = useCallback(() => {
    closingRef.current = true;
    const channel = channelRef.current;
    if (channel) {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    }
  }, []);

  return { sendMessage, onMessage, status, disconnect };
}
