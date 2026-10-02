export type ChatMessage = {
  type: "chat";
  id: string;
  text: string;
  timestamp: number;
};

export type FileMeta = {
  type: "file-meta";
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  timestamp: number;
};

export type FileChunk = {
  type: "file-chunk";
  fileId: string;
  chunkIndex: number;
  data: string; // base64-encoded chunk
};

export type FileComplete = {
  type: "file-complete";
  fileId: string;
  checksum: string; // hex-encoded SHA-256 of the whole file
};

// More variants are added here in later milestones.
export type DataChannelMessage = ChatMessage | FileMeta | FileChunk | FileComplete;
