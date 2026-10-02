"use client";

import Link from "next/link";
import { useState } from "react";
import { generateRoomId } from "@/lib/roomId";
import { usePeerConnection } from "@/hooks/usePeerConnection";
import { StatusPill } from "@/components/StatusPill";
import { CopyButton } from "@/components/CopyButton";
import { ChatPanel } from "@/components/ChatPanel";

export default function CreateRoomPage() {
  const [roomId, setRoomId] = useState<string | null>(null);

  const peerConnection = usePeerConnection(roomId ?? "", "sender");
  const { connectionState } = peerConnection;

  const handleCreateRoom = () => {
    setRoomId(generateRoomId());
  };

  const handleRetry = () => {
    setRoomId(null);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Create a room</h1>
        <Link href="/join" className="text-sm text-blue-600 hover:underline">
          Join a room instead →
        </Link>
      </header>

      {!roomId && (
        <button
          type="button"
          onClick={handleCreateRoom}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Create Room
        </button>
      )}

      {roomId && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
            <span className="font-mono text-2xl tracking-widest">{roomId}</span>
            <CopyButton value={roomId} />
          </div>

          {connectionState === "failed" ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <StatusPill label="Connection failed" tone="bad" />
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Start a new room
                </button>
              </div>
              <p className="text-xs text-gray-500">
                This can happen without a TURN server if either side is on a
                restrictive network (added in a later milestone).
              </p>
            </div>
          ) : connectionState === "disconnected" ? (
            <StatusPill label="Disconnected" tone="bad" />
          ) : connectionState === "connecting" ? (
            <StatusPill label="Connecting (WebRTC handshake)..." tone="neutral" />
          ) : connectionState === "connected" ? (
            <div className="flex flex-col gap-1">
              <StatusPill label="Connected (P2P)" tone="good" />
              <p className="text-xs text-gray-500">
                Signaling server disconnected — you&apos;re now directly connected.
              </p>
            </div>
          ) : (
            <StatusPill label="Waiting for peer..." tone="neutral" />
          )}

          <ChatPanel peerConnection={peerConnection} />
        </section>
      )}
    </main>
  );
}
