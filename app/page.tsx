"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generateRoomId } from "@/lib/roomId";
import { usePeerConnection } from "@/hooks/usePeerConnection";
import { StatusPill } from "@/components/StatusPill";
import { CopyButton } from "@/components/CopyButton";
import { MessageLog, type LogMessage } from "@/components/MessageLog";

export default function CreateRoomPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [draft, setDraft] = useState("");

  const { connectionState, sendData, onData } = usePeerConnection(roomId ?? "", "sender");

  useEffect(() => {
    if (!roomId) return;

    const offData = onData((data) => {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), text: data, from: "peer" }]);
    });

    return offData;
  }, [roomId, onData]);

  const handleCreateRoom = () => {
    setRoomId(generateRoomId());
    setMessages([]);
  };

  const handleRetry = () => {
    setRoomId(null);
    setMessages([]);
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    sendData(draft);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text: draft, from: "me" }]);
    setDraft("");
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

          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
            <MessageLog messages={messages} />
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a test message"
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={connectionState !== "connected"}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
