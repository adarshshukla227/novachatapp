import { useEffect, useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { Spinner } from "../ui/spinner";
import ChatListItem from "./chat-list-item";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import ChatListHeader from "./chat-list-header";
import { useSocket } from "@/hooks/use-socket";
import type { ChatType } from "@/types/chat.type";
import type { MessageType } from "../../types/chat.type";
import AiAssistantItem from "../AiAssistantItem";
import { useAiChat } from "@/layouts/app-layout";

const ChatList = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const {
    fetchChats,
    chats,
    isChatsLoading,
    addNewChat,
    updateChatLastMessage,
  } = useChat();
  const { user } = useAuth();
  const currentUserId = user?._id || null;

  const [searchQuery, setSearchQuery] = useState("");
  const { showAiChat, setShowAiChat } = useAiChat();

  const filteredChats =
    chats?.filter(
      (chat) =>
        chat.groupName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.participants?.some(
          (p) =>
            p._id !== currentUserId &&
            p.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    ) || [];

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!socket) return;
    const handleNewChat = (newChat: ChatType) => {
      console.log("Recieved new chat", newChat);
      addNewChat(newChat);
    };
    socket.on("chat:new", handleNewChat);
    return () => { socket.off("chat:new", handleNewChat); };
  }, [addNewChat, socket]);

  useEffect(() => {
    if (!socket) return;
    const handleChatUpdate = (data: { chatId: string; lastMessage: MessageType }) => {
      console.log("Recieved update on chat", data.lastMessage);
      updateChatLastMessage(data.chatId, data.lastMessage);
    };
    socket.on("chat:update", handleChatUpdate);
    return () => { socket.off("chat:update", handleChatUpdate); };
  }, [socket, updateChatLastMessage]);

  const onRoute = (id: string) => {
    setShowAiChat(false);
    navigate(`/chat/${id}`);
  };

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border">
      <ChatListHeader onSearch={setSearchQuery} />

      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-2 pt-1 space-y-1">
          <AiAssistantItem
            onClick={() => setShowAiChat(true)}
            isSelected={showAiChat}
          />

          <div className="border-t border-border my-1 mx-1" />

          {isChatsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-7 h-7" />
            </div>
          ) : filteredChats?.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              {searchQuery ? "No chat found" : "No chats created"}
            </div>
          ) : (
            filteredChats?.map((chat) => (
              <ChatListItem
                key={chat._id}
                chat={chat}
                currentUserId={currentUserId}
                onClick={() => onRoute(chat._id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatList;
