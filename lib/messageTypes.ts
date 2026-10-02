export type ChatMessage = {
  type: "chat";
  id: string;
  text: string;
  timestamp: number;
};

// More variants (file-meta, file-chunk, ...) are added here in later milestones.
export type DataChannelMessage = ChatMessage;
