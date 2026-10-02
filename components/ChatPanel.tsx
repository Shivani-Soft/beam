"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import type { usePeerConnection } from "@/hooks/usePeerConnection";

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  peerConnection,
}: {
  peerConnection: ReturnType<typeof usePeerConnection>;
}) {
  const { connectionState } = peerConnection;
  const { messages, sendMessage } = useChat(peerConnection);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const canSend = connectionState === "connected";
  const connectionLost =
    (connectionState === "disconnected" || connectionState === "failed") &&
    messages.length > 0;

  const handleSend = () => {
    if (!canSend || !draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
      {connectionLost && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Connection lost — messages can no longer be sent.
        </div>
      )}

      <div ref={listRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No messages yet — say hello</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col gap-0.5 ${
                message.from === "me" ? "items-end" : "items-start"
              }`}
            >
              <span
                className={`w-fit max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.from === "me"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-900"
                }`}
              >
                {message.text}
              </span>
              <span className="text-[10px] text-gray-400">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={!canSend}
          placeholder={canSend ? "Type a message" : "Not connected"}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
