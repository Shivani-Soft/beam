"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { usePeerConnection } from "@/hooks/usePeerConnection";
import type {
  DataChannelMessage,
  FileChunk,
  FileComplete,
  FileMeta,
} from "@/lib/messageTypes";

const CHUNK_SIZE = 16 * 1024; // 16KB — safely under DataChannel message size limits
const BUFFERED_AMOUNT_THRESHOLD = 1024 * 1024; // 1MB — pause sending above this
const PROGRESS_UPDATE_EVERY_N_CHUNKS = 8; // throttle re-renders on big transfers

export type FileTransferState = {
  fileId: string;
  name: string;
  size: number;
  bytesTransferred: number;
  status: "in-progress" | "completed" | "failed";
};

export type CompletedFile = {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  blob: Blob;
};

type IncomingEntry = {
  meta: FileMeta;
  chunks: (ArrayBuffer | null)[];
  bytesReceived: number;
};

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const sliceSize = 0x8000;
  for (let i = 0; i < bytes.length; i += sliceSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + sliceSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Chunked file transfer over the same JSON DataChannel protocol as chat
 * (lib/messageTypes.ts): file-meta announces an incoming file, file-chunk
 * carries base64 chunks, file-complete carries a whole-file SHA-256 for the
 * receiver to verify against the reassembled blob.
 *
 * Chunks are base64-encoded JSON rather than raw binary DataChannel frames.
 * That costs ~33% extra bytes on the wire, but usePeerConnection's
 * sendData/onData are string-only and shared with chat, so this keeps one
 * message format (and one listener contract) for the whole channel instead
 * of adding a parallel binary subprotocol for this milestone alone.
 */
export function useFileTransfer(peerConnection: ReturnType<typeof usePeerConnection>) {
  const { sendData, onData, isOpen, getBufferedAmount, waitForBufferedAmountBelow } =
    peerConnection;

  const [outgoingTransfers, setOutgoingTransfers] = useState<FileTransferState[]>([]);
  const [incomingTransfers, setIncomingTransfers] = useState<FileTransferState[]>([]);
  const [completedFiles, setCompletedFiles] = useState<CompletedFile[]>([]);

  const incomingBuffersRef = useRef<Map<string, IncomingEntry>>(new Map());

  useEffect(() => {
    return onData((data) => {
      let parsed: DataChannelMessage;
      try {
        parsed = JSON.parse(data);
      } catch {
        return; // not JSON at all — not ours, ignore
      }

      switch (parsed.type) {
        case "file-meta": {
          incomingBuffersRef.current.set(parsed.fileId, {
            meta: parsed,
            chunks: new Array(parsed.totalChunks).fill(null),
            bytesReceived: 0,
          });
          setIncomingTransfers((prev) => [
            ...prev,
            {
              fileId: parsed.fileId,
              name: parsed.name,
              size: parsed.size,
              bytesTransferred: 0,
              status: "in-progress",
            },
          ]);
          break;
        }

        case "file-chunk": {
          const entry = incomingBuffersRef.current.get(parsed.fileId);
          if (!entry) break; // unknown/already-finished transfer — ignore

          const buffer = base64ToArrayBuffer(parsed.data);
          if (entry.chunks[parsed.chunkIndex] == null) {
            entry.bytesReceived += buffer.byteLength;
          }
          entry.chunks[parsed.chunkIndex] = buffer;

          const isLastChunk = parsed.chunkIndex === entry.meta.totalChunks - 1;
          if (parsed.chunkIndex % PROGRESS_UPDATE_EVERY_N_CHUNKS === 0 || isLastChunk) {
            const bytesReceived = entry.bytesReceived;
            setIncomingTransfers((prev) =>
              prev.map((t) =>
                t.fileId === parsed.fileId ? { ...t, bytesTransferred: bytesReceived } : t
              )
            );
          }
          break;
        }

        case "file-complete": {
          const entry = incomingBuffersRef.current.get(parsed.fileId);
          if (!entry) break;
          incomingBuffersRef.current.delete(parsed.fileId);

          const fileId = parsed.fileId;
          const checksum = parsed.checksum;

          void (async () => {
            if (entry.chunks.some((chunk) => chunk == null)) {
              setIncomingTransfers((prev) =>
                prev.map((t) => (t.fileId === fileId ? { ...t, status: "failed" } : t))
              );
              return;
            }

            const blob = new Blob(entry.chunks as ArrayBuffer[], { type: entry.meta.mimeType });
            const actualChecksum = await sha256Hex(await blob.arrayBuffer());

            if (actualChecksum !== checksum) {
              setIncomingTransfers((prev) =>
                prev.map((t) => (t.fileId === fileId ? { ...t, status: "failed" } : t))
              );
              return;
            }

            setIncomingTransfers((prev) =>
              prev.map((t) =>
                t.fileId === fileId
                  ? { ...t, bytesTransferred: entry.meta.size, status: "completed" }
                  : t
              )
            );
            setCompletedFiles((prev) => [
              ...prev,
              {
                fileId,
                name: entry.meta.name,
                size: entry.meta.size,
                mimeType: entry.meta.mimeType,
                blob,
              },
            ]);
          })();
          break;
        }

        default:
          break; // not a file-transfer message (e.g. chat) — ignore
      }
    });
  }, [onData]);

  const sendFile = useCallback(
    async (file: File) => {
      const fileId = crypto.randomUUID();
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      setOutgoingTransfers((prev) => [
        ...prev,
        { fileId, name: file.name, size: file.size, bytesTransferred: 0, status: "in-progress" },
      ]);

      const markFailed = () => {
        setOutgoingTransfers((prev) =>
          prev.map((t) => (t.fileId === fileId ? { ...t, status: "failed" } : t))
        );
      };

      const meta: FileMeta = {
        type: "file-meta",
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        totalChunks,
        timestamp: Date.now(),
      };
      sendData(JSON.stringify(meta));

      let bytesSent = 0;
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (!isOpen()) {
          markFailed();
          return;
        }

        if (getBufferedAmount() > BUFFERED_AMOUNT_THRESHOLD) {
          await waitForBufferedAmountBelow(BUFFERED_AMOUNT_THRESHOLD);
          if (!isOpen()) {
            markFailed();
            return;
          }
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const buffer = await file.slice(start, end).arrayBuffer();

        const chunk: FileChunk = {
          type: "file-chunk",
          fileId,
          chunkIndex,
          data: arrayBufferToBase64(buffer),
        };
        sendData(JSON.stringify(chunk));

        bytesSent += buffer.byteLength;
        const isLastChunk = chunkIndex === totalChunks - 1;
        if (chunkIndex % PROGRESS_UPDATE_EVERY_N_CHUNKS === 0 || isLastChunk) {
          const sentSoFar = bytesSent;
          setOutgoingTransfers((prev) =>
            prev.map((t) => (t.fileId === fileId ? { ...t, bytesTransferred: sentSoFar } : t))
          );
        }
      }

      if (!isOpen()) {
        markFailed();
        return;
      }

      const checksum = await sha256Hex(await file.arrayBuffer());
      const complete: FileComplete = { type: "file-complete", fileId, checksum };
      sendData(JSON.stringify(complete));

      setOutgoingTransfers((prev) =>
        prev.map((t) =>
          t.fileId === fileId ? { ...t, bytesTransferred: file.size, status: "completed" } : t
        )
      );
    },
    [sendData, isOpen, getBufferedAmount, waitForBufferedAmountBelow]
  );

  return { outgoingTransfers, incomingTransfers, completedFiles, sendFile };
}
