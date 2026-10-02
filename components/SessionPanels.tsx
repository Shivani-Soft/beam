"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FileTransferPanel } from "@/components/FileTransferPanel";
import type { usePeerConnection } from "@/hooks/usePeerConnection";

export function SessionPanels({
  peerConnection,
}: {
  peerConnection: ReturnType<typeof usePeerConnection>;
}) {
  const [tab, setTab] = useState<"chat" | "files">("chat");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab("chat")}
          className={`flex-1 rounded px-3 py-1.5 ${
            tab === "chat" ? "bg-white shadow-sm" : "text-gray-500"
          }`}
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => setTab("files")}
          className={`flex-1 rounded px-3 py-1.5 ${
            tab === "files" ? "bg-white shadow-sm" : "text-gray-500"
          }`}
        >
          Files
        </button>
      </div>

      {/* Both panels stay mounted (just hidden) so their chat/transfer state
          doesn't reset when switching tabs. */}
      <div className={tab === "chat" ? "" : "hidden"}>
        <ChatPanel peerConnection={peerConnection} />
      </div>
      <div className={tab === "files" ? "" : "hidden"}>
        <FileTransferPanel peerConnection={peerConnection} />
      </div>
    </div>
  );
}
