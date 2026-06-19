import { getOtherUserAndGroup } from "@/lib/helper";
import { PROTECTED_ROUTES } from "@/routes/routes";
import type { ChatType } from "@/types/chat.type";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AvatarWithBadge from "../avatar-with-badge";
import { useState, useEffect } from "react";
import GroupInfoPanel from "./GroupInfoPanel";
import UserProfileDialog from "../user-profile-dialog";
import type { UserType } from "@/types/auth.type";
import { useSocket } from "@/hooks/use-socket";

interface Props {
  chat: ChatType;
  currentUserId: string | null;
  onLeaveGroup?: (chatId: string) => void;
  onGroupInfoToggle?: (isOpen: boolean) => void;
}

const ChatHeader = ({ chat, currentUserId, onLeaveGroup, onGroupInfoToggle }: Props) => {
  const navigate = useNavigate();
  const { name, subheading, avatar, isOnline, isGroup } = getOtherUserAndGroup(
    chat,
    currentUserId
  );

  const { socket } = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // ─── Listen for typing events ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chat._id) return;

    let typingTimeout: ReturnType<typeof setTimeout>;

    const handleTypingStart = ({ chatId }: { chatId: string; userId: string }) => {
      if (chatId === chat._id) {
        setIsTyping(true);
        // Safety fallback — agar typing:stop na aaye toh 3 second baad khud reset
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleTypingStop = ({ chatId }: { chatId: string; userId: string }) => {
      if (chatId === chat._id) {
        clearTimeout(typingTimeout);
        setIsTyping(false);
      }
    };

    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      clearTimeout(typingTimeout);
    };
  }, [socket, chat._id]);
  // ──────────────────────────────────────────────────────────────────────────

  const openPanel = () => {
    setShowGroupInfo(true);
    onGroupInfoToggle?.(true);
  };

  const closePanel = () => {
    setShowGroupInfo(false);
    onGroupInfoToggle?.(false);
  };

  const handleLeaveSuccess = (chatId: string) => {
    closePanel();
    if (onLeaveGroup) onLeaveGroup(chatId);
  };

  const otherUser = !isGroup
    ? (chat.participants?.find((p) => p._id !== currentUserId) as UserType | undefined) || null
    : null;

  const handleHeaderClick = () => {
    if (isGroup) {
      openPanel();
    } else {
      setShowUserProfile(true);
    }
  };

  // Subheading logic — typing ho toh "typing..." dikhao, warna normal status
  const statusText = isGroup
    ? `${chat.participants?.length ?? 0} members · tap for info`
    : isTyping
    ? "typing..."
    : subheading;

  const statusColor = isTyping
    ? "text-green-500"
    : isOnline
    ? "text-green-500"
    : "text-muted-foreground";

  return (
    <>
      <div className="sticky top-0 flex items-center gap-5 border-b border-border bg-card px-2 z-50">
        <div className="h-14 px-4 flex items-center">
          <ArrowLeft
            className="w-5 h-5 inline-block lg:hidden text-muted-foreground cursor-pointer mr-2"
            onClick={() => navigate(PROTECTED_ROUTES.CHAT)}
          />

          <div className="cursor-pointer" onClick={handleHeaderClick}>
            <AvatarWithBadge
              name={name}
              src={avatar}
              isGroup={isGroup}
              isOnline={isOnline}
            />
          </div>

          <div className="ml-2 cursor-pointer" onClick={handleHeaderClick}>
            <h5 className="font-semibold hover:opacity-80 transition">{name}</h5>
            <p className={`text-sm ${statusColor}`}>
              {statusText}
            </p>
          </div>
        </div>

        <div>
          <div className="flex-1 text-center py-4 h-full border-b-2 border-primary font-medium text-primary">
            Chat
          </div>
        </div>
      </div>

      {showGroupInfo && isGroup && (
        <GroupInfoPanel
          chatId={chat._id}
          groupName={name}
          memberCount={chat.participants?.length ?? 0}
          onClose={closePanel}
          onLeaveSuccess={handleLeaveSuccess}
        />
      )}

      <UserProfileDialog
        open={showUserProfile}
        onOpenChange={setShowUserProfile}
        user={otherUser}
      />
    </>
  );
};

export default ChatHeader;