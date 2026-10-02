"use client";

import { useEffect, useMemo } from "react";
import { useFileTransfer, type CompletedFile, type FileTransferState } from "@/hooks/useFileTransfer";
import type { usePeerConnection } from "@/hooks/usePeerConnection";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function ProgressRow({ transfer }: { transfer: FileTransferState }) {
  const percent =
    transfer.size === 0
      ? 100
      : Math.min(100, Math.round((transfer.bytesTransferred / transfer.size) * 100));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
        <span className="truncate">{transfer.name}</span>
        <span className="shrink-0">
          {transfer.status === "failed"
            ? "Failed"
            : transfer.status === "completed"
              ? formatBytes(transfer.size)
              : `${formatBytes(transfer.bytesTransferred)} / ${formatBytes(transfer.size)}`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-[width] ${
            transfer.status === "failed"
              ? "bg-red-500"
              : transfer.status === "completed"
                ? "bg-emerald-500"
                : "bg-blue-600"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function CompletedFileRow({ file }: { file: CompletedFile }) {
  const url = useMemo(() => URL.createObjectURL(file.blob), [file.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
      <span className="truncate">{file.name}</span>
      <a href={url} download={file.name} className="shrink-0 text-blue-600 hover:underline">
        Download
      </a>
    </div>
  );
}

export function FileTransferPanel({
  peerConnection,
}: {
  peerConnection: ReturnType<typeof usePeerConnection>;
}) {
  const { connectionState } = peerConnection;
  const { outgoingTransfers, incomingTransfers, completedFiles, sendFile } =
    useFileTransfer(peerConnection);

  const canSend = connectionState === "connected";
  const sendInFlight = outgoingTransfers.some((t) => t.status === "in-progress");
  const activeIncoming = incomingTransfers.filter((t) => t.status === "in-progress");
  const failedIncoming = incomingTransfers.filter((t) => t.status === "failed");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void sendFile(file);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <input
        type="file"
        onChange={handleFileChange}
        disabled={!canSend || sendInFlight}
        className="text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {!canSend && <p className="text-xs text-gray-500">Connect to a peer to send files.</p>}

      {outgoingTransfers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sending</h3>
          {outgoingTransfers.map((t) => (
            <ProgressRow key={t.fileId} transfer={t} />
          ))}
        </div>
      )}

      {activeIncoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Receiving
          </h3>
          {activeIncoming.map((t) => (
            <ProgressRow key={t.fileId} transfer={t} />
          ))}
        </div>
      )}

      {failedIncoming.length > 0 && (
        <div className="flex flex-col gap-2">
          {failedIncoming.map((t) => (
            <p key={t.fileId} className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {t.name} failed checksum verification — the file is corrupted or incomplete.
            </p>
          ))}
        </div>
      )}

      {completedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Received files
          </h3>
          {completedFiles.map((file) => (
            <CompletedFileRow key={file.fileId} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}
