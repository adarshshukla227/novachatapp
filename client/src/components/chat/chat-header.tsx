import { getOtherUserAndGroup } from "@/lib/helper";
import { PROTECTED_ROUTES } from "@/routes/routes";
import type { ChatType } from "@/types/chat.type";
import { ArrowLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AvatarWithBadge from "../avatar-with-badge";
import { useState, useEffect, useRef } from "react";
import GroupInfoPanel from "./GroupInfoPanel";
import UserProfileDialog from "../user-profile-dialog";
import type { UserType } from "@/types/auth.type";
import { useSocket } from "@/hooks/use-socket";

interface Props {
  chat: ChatType;
  currentUserId: string | null;
  onLeaveGroup?: (chatId: string) => void;
  onGroupInfoToggle?: (isOpen: boolean) => void;
  onSearchQuery?: (query: string) => void;
}

const ChatHeader = ({ chat, currentUserId, onLeaveGroup, onGroupInfoToggle, onSearchQuery }: Props) => {
  const navigate = useNavigate();
  const { name, subheading, avatar, isOnline, isGroup } = getOtherUserAndGroup(
    chat,
    currentUserId
  );

  const { socket } = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Typing indicator ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chat._id) return;
    let typingTimeout: ReturnType<typeof setTimeout>;

    const handleTypingStart = ({ chatId }: { chatId: string }) => {
      if (chatId === chat._id) {
        setIsTyping(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleTypingStop = ({ chatId }: { chatId: string }) => {
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

  // Search input focus
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchValue("");
      onSearchQuery?.("");
    }
  }, [showSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearchQuery?.(e.target.value);
  };

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
      <div className="sticky top-0 border-b border-border bg-card z-50">
        {/* Main header row */}
        <div className="flex items-center gap-2 px-2 h-14">
          <ArrowLeft
            className="w-5 h-5 inline-block lg:hidden text-muted-foreground cursor-pointer mr-1 shrink-0"
            onClick={() => navigate(PROTECTED_ROUTES.CHAT)}
          />

          <div className="cursor-pointer shrink-0" onClick={handleHeaderClick}>
            <AvatarWithBadge
              name={name}
              src={avatar}
              isGroup={isGroup}
              isOnline={isOnline}
            />
          </div>

          <div className="flex-1 min-w-0 cursor-pointer ml-1" onClick={handleHeaderClick}>
            <h5 className="font-semibold hover:opacity-80 transition truncate">{name}</h5>
            <p className={`text-sm truncate ${statusColor}`}>
              {statusText}
            </p>
          </div>

          {/* Search toggle button */}
          <button
            onClick={() => setShowSearch((p) => !p)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${
              showSearch
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            {showSearch ? <X size={17} /> : <Search size={17} />}
          </button>

          <div className="shrink-0">
            <div className="flex-1 text-center py-4 h-full border-b-2 border-primary font-medium text-primary">
              Chat
            </div>
          </div>
        </div>

        {/* Search bar — slides in below header */}
        {showSearch && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <Search size={15} className="text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search in conversation..."
              className="flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchValue && (
              <button
                onClick={() => { setSearchValue(""); onSearchQuery?.(""); }}
                className="text-muted-foreground hover:text-foreground transition shrink-0"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
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