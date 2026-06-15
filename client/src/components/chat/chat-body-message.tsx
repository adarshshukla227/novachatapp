import { memo, useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import type { MessageType } from "@/types/chat.type";
import AvatarWithBadge from "../avatar-with-badge";
import { formatChatTime } from "@/lib/helper";
import { Button } from "../ui/button";
import { ReplyIcon, Check, CheckCheck, Clock, SmilePlus, Sparkles } from "lucide-react";

interface Props {
  message: MessageType;
  onReply: (message: MessageType) => void;
  onSmartReply?: (text: string) => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const ChatMessageBody = memo(({ message, onReply, onSmartReply }: Props) => {
  const { user } = useAuth();
  const { reactToMessage } = useChat();
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const emojiBarRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const userId = user?._id || null;
  const isCurrentUser = message.sender?._id === userId;
  const senderName = isCurrentUser ? "You" : message.sender?.name;

  const replySendername =
    message.replyTo?.sender?._id === userId
      ? "You"
      : message.replyTo?.sender?.name;

  useEffect(() => {
    if (!showEmojiBar) return;
    const handler = (e: MouseEvent) => {
      if (emojiBarRef.current && !emojiBarRef.current.contains(e.target as Node)) {
        setShowEmojiBar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiBar]);

  const containerClass = cn(
    "group flex gap-2 py-3 px-4",
    isCurrentUser && "flex-row-reverse text-left"
  );

  const contentWrapperClass = cn(
    "max-w-[70%] flex flex-col relative",
    isCurrentUser && "items-end"
  );

  const messageClass = cn(
    "min-w-[200px] px-3 py-2 text-sm break-words shadow-sm",
    isCurrentUser
      ? "bg-accent dark:bg-primary/40 rounded-tr-xl rounded-l-xl"
      : "bg-[#F5F5F5] dark:bg-accent rounded-bl-xl rounded-r-xl"
  );

  const replyBoxClass = cn(
    `mb-2 p-2 text-xs rounded-md border-l-4 shadow-md !text-left`,
    isCurrentUser
      ? "bg-primary/20 border-l-primary"
      : "bg-gray-200 dark:bg-secondary border-l-[#CC4A31]"
  );

  const renderStatusTicks = () => {
    if (!isCurrentUser) return null;
    const status = message.status?.toLowerCase();
    switch (status) {
      case "sending":
      case "sending...":
        return <Clock className="w-3.5 h-3.5 text-gray-400" />;
      case "sent":
        return <Check className="w-3.5 h-3.5 text-gray-400" />;
      case "delivered":
        return <CheckCheck className="w-3.5 h-3.5 text-gray-400" />;
      case "seen":
      case "read":
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return message._id ? (
          <Check className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-gray-400" />
        );
    }
  };

  const reactions = message.reactions || [];
  const groupedReactions: { emoji: string; count: number; reactedByMe: boolean }[] = [];
  reactions.forEach((r) => {
    const existing = groupedReactions.find((g) => g.emoji === r.emoji);
    const rUserId = typeof r.user === "string" ? r.user : r.user?._id;
    if (existing) {
      existing.count += 1;
      if (rUserId === userId) existing.reactedByMe = true;
    } else {
      groupedReactions.push({
        emoji: r.emoji,
        count: 1,
        reactedByMe: rUserId === userId,
      });
    }
  });

  const handleEmojiClick = (emoji: string) => {
    reactToMessage(message._id, emoji);
    setShowEmojiBar(false);
  };

  const handleSmartReply = async () => {
    if (!message.content) return;

    if (showSuggestions) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    setShowSuggestions(true);

    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              {
                role: "user",
                content: `You are a smart reply assistant for a chat app. Generate exactly 3 short reply suggestions for this message: "${message.content}". Return ONLY a JSON array of 3 strings under 8 words each. Example: ["Sure!", "Sounds good!", "Let me check."]`,
              },
            ],
            temperature: 0.7,
            max_tokens: 100,
          }),
        }
      );

      const responseText = await res.text();

      if (!res.ok) {
        console.error("Groq full error:", responseText);
        setSuggestions(["Sure!", "Let me check.", "Sounds good!"]);
        return;
      }

      const data = JSON.parse(responseText);
      const rawText = data?.choices?.[0]?.message?.content || "[]";
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const parsed: string[] = JSON.parse(cleaned);
      setSuggestions(parsed.slice(0, 3));
    } catch (err) {
      console.error("Smart reply error:", err);
      setSuggestions(["Sure!", "Let me check.", "Sounds good!"]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    onSmartReply?.(text);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div className={containerClass}>
      {!isCurrentUser && (
        <div className="flex-shrink-0 flex items-start">
          <AvatarWithBadge
            name={message.sender?.name || "No name"}
            src={message.sender?.avatar || ""}
          />
        </div>
      )}

      <div className={contentWrapperClass}>
        <div
          className={cn(
            "flex items-center gap-1 relative",
            isCurrentUser && "flex-row-reverse"
          )}
        >
          <div className="relative">
            <div className={messageClass}>
              <div className="flex items-center gap-2 mb-0.5 pb-1">
                <span className="text-xs font-semibold">{senderName}</span>
                <span className="text-[11px] text-gray-700 dark:text-gray-300">
                  {formatChatTime(message?.createdAt)}
                </span>
              </div>

              {message.replyTo && (
                <div className={replyBoxClass}>
                  <h5 className="font-medium">{replySendername}</h5>
                  <p className="font-normal text-muted-foreground max-w-[250px] truncate">
                    {message?.replyTo?.content ||
                      (message?.replyTo?.image ? "📷 Photo" : "")}
                  </p>
                </div>
              )}

              {message?.image && (
                <img
                  src={message?.image || ""}
                  alt=""
                  className="rounded-lg max-w-xs"
                />
              )}

              {message.content && <p>{message.content}</p>}
            </div>

            {groupedReactions.length > 0 && (
              <div
                className={cn(
                  "absolute -bottom-3 flex gap-1",
                  isCurrentUser ? "right-2" : "left-2"
                )}
              >
                {groupedReactions.map((g) => (
                  <button
                    key={g.emoji}
                    onClick={() => handleEmojiClick(g.emoji)}
                    className={cn(
                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs shadow-sm border transition",
                      g.reactedByMe
                        ? "bg-primary/15 border-primary/40"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    <span>{g.emoji}</span>
                    {g.count > 1 && (
                      <span className="text-[10px] text-muted-foreground">{g.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1 relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onReply(message)}
              className="rounded-full !size-8"
            >
              <ReplyIcon
                size={16}
                className={cn(
                  "text-gray-500 dark:text-white !stroke-[1.9]",
                  isCurrentUser && "scale-x-[-1]"
                )}
              />
            </Button>

            {!isCurrentUser && message.content && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleSmartReply}
                className={cn(
                  "rounded-full !size-8",
                  showSuggestions && "bg-primary/10 border-primary"
                )}
                title="Smart Reply"
              >
                {loadingSuggestions ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles size={15} className="text-primary !stroke-[1.9]" />
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowEmojiBar((p) => !p)}
              className="rounded-full !size-8"
            >
              <SmilePlus size={16} className="text-gray-500 dark:text-white !stroke-[1.9]" />
            </Button>

            {showEmojiBar && (
              <div
                ref={emojiBarRef}
                className={cn(
                  "absolute z-50 top-full mt-1 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5",
                  isCurrentUser ? "right-0" : "left-0"
                )}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showSuggestions && (
          <div
            className={cn(
              "flex flex-wrap gap-2 mt-4",
              isCurrentUser ? "justify-end" : "justify-start"
            )}
          >
            {loadingSuggestions ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-7 w-24 rounded-full bg-muted animate-pulse"
                  />
                ))}
              </>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium
                    border border-primary/40 text-primary
                    bg-primary/5 hover:bg-primary/15
                    transition-all hover:scale-105 shadow-sm"
                >
                  ✨ {s}
                </button>
              ))
            )}
          </div>
        )}

        {isCurrentUser && (
          <span className="flex items-center justify-end gap-1 mt-3.5">
            {renderStatusTicks()}
          </span>
        )}
      </div>
    </div>
  );
});

ChatMessageBody.displayName = "ChatMessageBody";

export default ChatMessageBody;