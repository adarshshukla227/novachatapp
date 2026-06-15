import { getOtherUserAndGroup } from "@/lib/helper";
import { cn } from "@/lib/utils";
import type { ChatType } from "@/types/chat.type";
import { useLocation } from "react-router-dom";
import AvatarWithBadge from "../avatar-with-badge";
import { formatChatTime } from "../../lib/helper";

interface PropsType {
  chat: ChatType;
  currentUserId: string | null;
  onClick?: () => void;
}
const ChatListItem = ({ chat, currentUserId, onClick }: PropsType) => {
  const { pathname } = useLocation();
  const { lastMessage, createdAt, unreadCount = 0 } = chat;

  const { name, avatar, isOnline, isGroup } = getOtherUserAndGroup(
    chat,
    currentUserId
  );

  const hasUnread = unreadCount > 0;

  const getLastMessageText = () => {
    if (!lastMessage) {
      return isGroup
        ? chat.createdBy === currentUserId
          ? "Group created"
          : "You were added"
        : "Send a message";
    }
    if (lastMessage.image) return "📷 Photo";

    if (isGroup && lastMessage.sender) {
      return `${
        lastMessage.sender._id === currentUserId
          ? "You"
          : lastMessage.sender.name
      }: ${lastMessage.content}`;
    }

    return lastMessage.content;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        `w-full flex items-center gap-2 p-2 rounded-sm
         hover:bg-sidebar-accent transition-colors text-left`,
        pathname.includes(chat._id) && "!bg-sidebar-accent"
      )}
    >
      <AvatarWithBadge
        name={name}
        src={avatar}
        isGroup={isGroup}
        isOnline={isOnline}
      />

      <div className="flex-1 min-w-0">
        <div
          className="
         flex items-center justify-between mb-0.5
        "
        >
          <h5
            className={cn(
              "text-sm truncate",
              hasUnread ? "font-bold" : "font-semibold"
            )}
          >
            {name}
          </h5>
          <span
            className={cn(
              "text-xs ml-2 shrink-0",
              hasUnread ? "text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            {formatChatTime(lastMessage?.updatedAt || createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-xs truncate -mt-px flex-1",
              hasUnread
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {getLastMessageText()}
          </p>

          {/* NEW — Unread count badge, WhatsApp style */}
          {hasUnread && (
            <span
              className="
                shrink-0 min-w-[20px] h-5 px-1.5
                flex items-center justify-center
                rounded-full bg-primary text-primary-foreground
                text-[11px] font-semibold leading-none
              "
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ChatListItem;
