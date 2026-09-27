export type LogMessage = {
  id: string;
  text: string;
  from: "me" | "peer";
};

export function MessageLog({ messages }: { messages: LogMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No messages yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {messages.map((message) => (
        <li
          key={message.id}
          className={`w-fit max-w-[80%] rounded-lg px-3 py-2 text-sm ${
            message.from === "me"
              ? "self-end bg-blue-600 text-white"
              : "self-start bg-gray-200 text-gray-900"
          }`}
        >
          {message.text}
        </li>
      ))}
    </ul>
  );
}
