"use client";

import Link from "next/link";
import { useState } from "react";
import { usePeerConnection } from "@/hooks/usePeerConnection";
import { StatusPill } from "@/components/StatusPill";
import { SessionPanels } from "@/components/SessionPanels";

export default function JoinRoomPage() {
  const [roomIdInput, setRoomIdInput] = useState("");
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);

  const peerConnection = usePeerConnection(joinedRoomId ?? "", "receiver");
  const { connectionState } = peerConnection;

  const handleJoin = () => {
    const trimmed = roomIdInput.trim().toUpperCase();
    if (!trimmed) return;
    setJoinedRoomId(trimmed);
  };

  const handleRetry = () => {
    setJoinedRoomId(null);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Join a room</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Create a room instead
        </Link>
      </header>

      {!joinedRoomId && (
        <div className="flex gap-2">
          <input
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Enter room ID"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 font-mono uppercase tracking-widest"
          />
          <button
            type="button"
            onClick={handleJoin}
            className="rounded-md bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            Join
          </button>
        </div>
      )}

      {joinedRoomId && (
        <section className="flex flex-col gap-4">
          {connectionState === "failed" ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <StatusPill label="Connection failed" tone="bad" />
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Try a different room ID
                </button>
              </div>
              <p className="text-xs text-gray-500">
                This can happen without a TURN server if either side is on a
                restrictive network (added in a later milestone).
              </p>
            </div>
          ) : connectionState === "disconnected" ? (
            <div className="flex items-center gap-3">
              <StatusPill label="Disconnected" tone="bad" />
              <button
                type="button"
                onClick={handleRetry}
                className="text-sm text-blue-600 hover:underline"
              >
                Try a different room ID
              </button>
            </div>
          ) : connectionState === "connecting" ? (
            <StatusPill label="Connecting (WebRTC handshake)..." tone="neutral" />
          ) : connectionState === "connected" ? (
            <div className="flex flex-col gap-1">
              <StatusPill label={`Connected to room ${joinedRoomId} (P2P)`} tone="good" />
              <p className="text-xs text-gray-500">
                Signaling server disconnected — you&apos;re now directly connected.
              </p>
            </div>
          ) : (
            <StatusPill label="Connecting..." tone="neutral" />
          )}

          <SessionPanels peerConnection={peerConnection} />
        </section>
      )}
    </main>
  );
}
