"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignalingChannel } from "@/hooks/useSignalingChannel";
import { webrtcConfig } from "@/lib/webrtc-config";

export type PeerConnectionState =
  | "idle"
  | "signaling"
  | "connecting"
  | "connected"
  | "failed"
  | "disconnected";

type DataListener = (data: string) => void;

/**
 * Establishes an RTCPeerConnection + RTCDataChannel between two browsers,
 * using the Milestone 1 Supabase signaling channel purely as a handshake
 * transport. Once the DataChannel is open the signaling channel is torn
 * down — everything after that goes directly peer-to-peer.
 */
export function usePeerConnection(roomId: string, role: "sender" | "receiver") {
  const {
    sendMessage,
    onMessage,
    status: signalingStatus,
    disconnect: disconnectSignaling,
  } = useSignalingChannel(roomId);

  const [connectionState, setConnectionState] = useState<PeerConnectionState>("idle");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const dataListenersRef = useRef<Set<DataListener>>(new Set());
  const hasRemoteDescriptionRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const hasOfferedRef = useRef(false);

  // Derive the "idle"/"signaling"/"failed"/"connecting" baseline transitions
  // synchronously during render rather than in an effect (see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // matching the pattern useSignalingChannel already uses.
  const [lastRoomId, setLastRoomId] = useState(roomId);
  const [lastSignalingStatus, setLastSignalingStatus] = useState(signalingStatus);
  if (roomId !== lastRoomId) {
    setLastRoomId(roomId);
    setLastSignalingStatus(signalingStatus);
    setConnectionState(roomId ? "signaling" : "idle");
  } else if (signalingStatus !== lastSignalingStatus) {
    setLastSignalingStatus(signalingStatus);
    if (roomId) {
      if (signalingStatus === "error") {
        setConnectionState("failed");
      } else if (signalingStatus === "connected") {
        setConnectionState((prev) => (prev === "signaling" ? "connecting" : prev));
      }
    }
  }

  // Create/tear down the RTCPeerConnection (and, for the sender, the
  // RTCDataChannel) whenever we get a new room to connect for.
  useEffect(() => {
    if (!roomId) return;

    hasRemoteDescriptionRef.current = false;
    pendingCandidatesRef.current = [];
    hasOfferedRef.current = false;

    const pc = new RTCPeerConnection(webrtcConfig);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage("ice-candidate", { candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        setConnectionState("failed");
      }
    };

    const attachDataChannel = (channel: RTCDataChannel) => {
      dcRef.current = channel;
      channel.onopen = () => {
        setConnectionState("connected");
        disconnectSignaling();
      };
      channel.onclose = () => {
        setConnectionState((prev) => (prev === "failed" ? prev : "disconnected"));
      };
      channel.onerror = () => {
        setConnectionState("failed");
      };
      channel.onmessage = (event) => {
        dataListenersRef.current.forEach((callback) => callback(event.data));
      };
    };

    if (role === "sender") {
      attachDataChannel(pc.createDataChannel("main"));
    } else {
      pc.ondatachannel = (event) => attachDataChannel(event.channel);
    }

    return () => {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;
      if (dcRef.current) {
        dcRef.current.onopen = null;
        dcRef.current.onclose = null;
        dcRef.current.onerror = null;
        dcRef.current.onmessage = null;
        dcRef.current.close();
        dcRef.current = null;
      }
      pc.close();
      pcRef.current = null;
    };
  }, [roomId, role, sendMessage, disconnectSignaling]);

  // Drive the handshake off the signaling channel's status.
  useEffect(() => {
    if (!roomId) return;
    if (signalingStatus !== "connected") return;

    const pc = pcRef.current;
    if (!pc) return;

    if (role === "sender" && !hasOfferedRef.current) {
      hasOfferedRef.current = true;
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendMessage("offer", { sdp: offer });
        } catch {
          setConnectionState("failed");
        }
      })();
    }

    if (role === "receiver") {
      // Let the sender know we're actually subscribed. Broadcasts aren't
      // replayed to late subscribers, so without this a sender offer sent
      // right as the room is created could go out before we're listening.
      sendMessage("peer-ready", {});
    }
  }, [roomId, role, signalingStatus, sendMessage]);

  // Wire up the signaling messages that carry the SDP/ICE handshake.
  useEffect(() => {
    if (!roomId) return;

    const pc = pcRef.current;
    if (!pc) return;

    const flushPendingCandidates = async () => {
      const queued = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Late/malformed candidate — safe to ignore.
        }
      }
    };

    const unsubscribers: Array<() => void> = [];

    if (role === "receiver") {
      unsubscribers.push(
        onMessage("offer", async (payload) => {
          const { sdp } = payload as { sdp: RTCSessionDescriptionInit };
          try {
            await pc.setRemoteDescription(sdp);
            hasRemoteDescriptionRef.current = true;
            await flushPendingCandidates();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendMessage("answer", { sdp: answer });
          } catch {
            setConnectionState("failed");
          }
        })
      );
    }

    if (role === "sender") {
      unsubscribers.push(
        onMessage("answer", async (payload) => {
          const { sdp } = payload as { sdp: RTCSessionDescriptionInit };
          try {
            await pc.setRemoteDescription(sdp);
            hasRemoteDescriptionRef.current = true;
            await flushPendingCandidates();
          } catch {
            setConnectionState("failed");
          }
        })
      );

      unsubscribers.push(
        onMessage("peer-ready", () => {
          if (pc.localDescription && pc.connectionState !== "connected") {
            sendMessage("offer", { sdp: pc.localDescription.toJSON() });
          }
        })
      );
    }

    unsubscribers.push(
      onMessage("ice-candidate", async (payload) => {
        const { candidate } = payload as { candidate: RTCIceCandidateInit };
        if (!hasRemoteDescriptionRef.current) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Late/malformed candidate — safe to ignore.
        }
      })
    );

    return () => {
      unsubscribers.forEach((off) => off());
    };
  }, [roomId, role, onMessage, sendMessage]);

  const sendData = useCallback((data: string) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(data);
    } else {
      console.warn("usePeerConnection: cannot send, data channel is not open");
    }
  }, []);

  const isOpen = useCallback(() => dcRef.current?.readyState === "open", []);

  const getBufferedAmount = useCallback(() => dcRef.current?.bufferedAmount ?? 0, []);

  // Lets a caller doing its own chunked/paced sending (e.g. file transfer)
  // wait out backpressure instead of flooding dc.send() past bufferedAmount.
  const waitForBufferedAmountBelow = useCallback((threshold: number) => {
    return new Promise<void>((resolve) => {
      const dc = dcRef.current;
      if (!dc || dc.bufferedAmount <= threshold) {
        resolve();
        return;
      }
      const onDrainOrClose = () => {
        dc.removeEventListener("bufferedamountlow", onDrainOrClose);
        dc.removeEventListener("close", onDrainOrClose);
        resolve();
      };
      dc.bufferedAmountLowThreshold = threshold;
      dc.addEventListener("bufferedamountlow", onDrainOrClose);
      dc.addEventListener("close", onDrainOrClose);
    });
  }, []);

  const onData = useCallback((callback: DataListener) => {
    dataListenersRef.current.add(callback);
    return () => {
      dataListenersRef.current.delete(callback);
    };
  }, []);

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    disconnectSignaling();
    setConnectionState("disconnected");
  }, [disconnectSignaling]);

  return {
    connectionState,
    sendData,
    onData,
    disconnect,
    isOpen,
    getBufferedAmount,
    waitForBufferedAmountBelow,
  };
}
