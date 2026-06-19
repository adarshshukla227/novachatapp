import { useChat } from "@/hooks/use-chat";
import { useSocket } from "@/hooks/use-socket";
import type { MessageType } from "@/types/chat.type";
import { useEffect, useRef, useState } from "react";
import ChatBodyMessage from "./chat-body-message";

interface Props {
  chatId: string | null;
  messages: MessageType[];
  onReply: (message: MessageType) => void;
  onSmartReply: (text: string) => void;
  searchQuery?: string;
}

const ChatBody = ({ chatId, messages, onReply, onSmartReply, searchQuery = "" }: Props) => {
  const { socket } = useSocket();
  const { addNewMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId || !socket) return;
    const handleNewMessage = (msg: MessageType) => addNewMessage(chatId, msg);
    socket.on("message:new", handleNewMessage);
    return () => { socket.off("message:new", handleNewMessage); };
  }, [socket, chatId, addNewMessage]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (!messages.length || searchQuery) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, searchQuery]);

  // Search — jab searchQuery change ho, pehla matching message dhundho aur scroll karo
  useEffect(() => {
    if (!searchQuery.trim()) {
      setHighlightedId(null);
      return;
    }

    const matched = messages.find((m) =>
      typeof m.content === "string" &&
      m.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matched) {
      setHighlightedId(matched._id);
      setTimeout(() => {
        messageRefs.current[matched._id]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    } else {
      setHighlightedId(null);
    }
  }, [searchQuery, messages]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col px-3 py-2">
      {messages.map((message) => (
        <div
          key={message._id}
          ref={(el) => { messageRefs.current[message._id] = el; }}
          className={`rounded-xl transition-all duration-500 ${
            highlightedId === message._id
              ? "bg-yellow-200/40 dark:bg-yellow-500/20 ring-2 ring-yellow-400/50"
              : ""
          }`}
        >
          <ChatBodyMessage
            message={message}
            onReply={onReply}
            onSmartReply={onSmartReply}
            searchQuery={searchQuery}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatBody;