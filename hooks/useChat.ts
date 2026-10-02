"use client";

import { useCallback, useEffect, useState } from "react";
import type { usePeerConnection } from "@/hooks/usePeerConnection";
import type { ChatMessage, DataChannelMessage } from "@/lib/messageTypes";

export type ChatEntry = ChatMessage & { from: "me" | "peer" };

/**
 * Turns the raw string channel from usePeerConnection into a structured chat
 * feed: serializes outgoing messages, parses + narrows incoming ones, and
 * keeps everything (sent and received) in chronological order.
 */
export function useChat(peerConnection: ReturnType<typeof usePeerConnection>) {
  const { sendData, onData } = peerConnection;
  const [messages, setMessages] = useState<ChatEntry[]>([]);

  useEffect(() => {
    return onData((data) => {
      let parsed: DataChannelMessage;
      try {
        parsed = JSON.parse(data);
      } catch {
        console.warn("useChat: received malformed data channel message", data);
        return;
      }

      if (parsed.type === "chat") {
        setMessages((prev) => [...prev, { ...parsed, from: "peer" }]);
      } else if (
        parsed.type !== "file-meta" &&
        parsed.type !== "file-chunk" &&
        parsed.type !== "file-complete"
      ) {
        // Known-but-foreign types (file transfer messages, handled by
        // useFileTransfer) are expected and silently skipped; only warn on
        // something genuinely unrecognized.
        console.warn("useChat: ignoring unrecognized message type", parsed);
      }
    });
  }, [onData]);

  const sendMessage = useCallback(
    (text: string) => {
      const message: ChatMessage = {
        type: "chat",
        id: crypto.randomUUID(),
        text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, { ...message, from: "me" }]);
      sendData(JSON.stringify(message));
    },
    [sendData]
  );

  return { messages, sendMessage };
}
