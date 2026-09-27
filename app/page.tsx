"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generateRoomId } from "@/lib/roomId";
import { useSignalingChannel } from "@/hooks/useSignalingChannel";
import { StatusPill } from "@/components/StatusPill";
import { CopyButton } from "@/components/CopyButton";
import { MessageLog, type LogMessage } from "@/components/MessageLog";

export default function CreateRoomPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peerJoined, setPeerJoined] = useState(false);
  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [draft, setDraft] = useState("");

  const { sendMessage, onMessage, status } = useSignalingChannel(roomId ?? "");

  useEffect(() => {
    if (!roomId) return;

    const offPeerJoined = onMessage("peer-joined", () => setPeerJoined(true));
    const offTestMessage = onMessage("test-message", (payload) => {
      const text = (payload as { text: string }).text;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, from: "peer" }]);
    });

    return () => {
      offPeerJoined();
      offTestMessage();
    };
  }, [roomId, onMessage]);

  const handleCreateRoom = () => {
    setRoomId(generateRoomId());
    setPeerJoined(false);
    setMessages([]);
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage("test-message", { text: draft });
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

          {status === "error" ? (
            <StatusPill label="Connection error" tone="bad" />
          ) : status === "connecting" ? (
            <StatusPill label="Connecting..." tone="neutral" />
          ) : peerJoined ? (
            <StatusPill label="Peer connected" tone="good" />
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
                disabled={status !== "connected"}
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
