"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSignalingChannel } from "@/hooks/useSignalingChannel";
import { StatusPill } from "@/components/StatusPill";
import { MessageLog, type LogMessage } from "@/components/MessageLog";

export default function JoinRoomPage() {
  const [roomIdInput, setRoomIdInput] = useState("");
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [draft, setDraft] = useState("");
  const hasAnnouncedJoin = useRef(false);

  const { sendMessage, onMessage, status } = useSignalingChannel(joinedRoomId ?? "");

  // Announce our presence to the sender as soon as the channel is live.
  useEffect(() => {
    if (status === "connected" && !hasAnnouncedJoin.current) {
      hasAnnouncedJoin.current = true;
      sendMessage("peer-joined", {});
    }
  }, [status, sendMessage]);

  useEffect(() => {
    if (!joinedRoomId) return;

    const offTestMessage = onMessage("test-message", (payload) => {
      const text = (payload as { text: string }).text;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, from: "peer" }]);
    });

    return () => {
      offTestMessage();
    };
  }, [joinedRoomId, onMessage]);

  const handleJoin = () => {
    const trimmed = roomIdInput.trim().toUpperCase();
    if (!trimmed) return;
    hasAnnouncedJoin.current = false;
    setMessages([]);
    setJoinedRoomId(trimmed);
  };

  const handleRetry = () => {
    setJoinedRoomId(null);
    hasAnnouncedJoin.current = false;
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
          {status === "error" ? (
            <div className="flex items-center gap-3">
              <StatusPill label="Connection error" tone="bad" />
              <button
                type="button"
                onClick={handleRetry}
                className="text-sm text-blue-600 hover:underline"
              >
                Try a different room ID
              </button>
            </div>
          ) : status === "connecting" ? (
            <StatusPill label="Connecting..." tone="neutral" />
          ) : (
            <StatusPill label={`Connected to room ${joinedRoomId}`} tone="good" />
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
