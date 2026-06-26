import { create } from "zustand";
import type { UserType } from "@/types/auth.type";
import type {
  ChatType,
  CreateChatType,
  CreateMessageType,
  MessageType,
} from "@/types/chat.type";
import { API } from "@/lib/axios-client";
import { toast } from "sonner";
import { useAuth } from "./use-auth";
import { generateUUID } from "@/lib/helper";
 
interface ChatState {
  chats: ChatType[];
  users: UserType[];
  singleChat: {
    chat: ChatType;
    messages: MessageType[];
  } | null;
 
  currentAIStreamId: string | null;
 
  isChatsLoading: boolean;
  isUsersLoading: boolean;
  isCreatingChat: boolean;
  isSingleChatLoading: boolean;
  isSendingMsg: boolean;
 
  fetchAllUsers: () => void;
  fetchChats: () => void;
  createChat: (payload: CreateChatType) => Promise<ChatType | null>;
  fetchSingleChat: (chatId: string) => void;
  sendMessage: (payload: CreateMessageType) => void;
 
  addNewChat: (newChat: ChatType) => void;
  updateChatLastMessage: (chatId: string, lastMessage: MessageType) => void;
  addNewMessage: (chatId: string, message: MessageType) => void;
  removeChat: (chatId: string) => void;
 
  reactToMessage: (messageId: string, emoji: string) => void;
  updateMessageReactions: (messageId: string, reactions: any[]) => void;
 
  markAsSeen: (chatId: string) => void;
  updateMessagesSeenStatus: (messageIds: string[]) => void;
 
  updateMessageDelivered: (messageId: string) => void;
 
  clearUnreadCount: (chatId: string) => void;

  // ✅ Naya function — group ka avatar/name/description global state mein sync karega
  updateGroupInfo: (
    chatId: string,
    updates: Partial<Pick<ChatType, "groupName" | "groupDescription" | "groupAvatar">>
  ) => void;
}
 
export const useChat = create<ChatState>()((set, get) => ({
  chats: [],
  users: [],
  singleChat: null,
 
  isChatsLoading: false,
  isUsersLoading: false,
  isCreatingChat: false,
  isSingleChatLoading: false,
  isSendingMsg: false,
 
  currentAIStreamId: null,
 
  fetchAllUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const { data } = await API.get("/user/all");
      set({ users: data.users });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },
 
  fetchChats: async () => {
    set({ isChatsLoading: true });
    try {
      const { data } = await API.get("/chat/all");
      set({ chats: data.chats });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
    } finally {
      set({ isChatsLoading: false });
    }
  },
 
  createChat: async (payload: CreateChatType) => {
    set({ isCreatingChat: true });
    try {
      const response = await API.post("/chat/create", { ...payload });
      get().addNewChat(response.data.chat);
      toast.success("Chat created successfully");
      return response.data.chat;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
      return null;
    } finally {
      set({ isCreatingChat: false });
    }
  },
 
  fetchSingleChat: async (chatId: string) => {
    set({ isSingleChatLoading: true });
 
    // ✅ Chat open hote hi turant badge hatao — API ka wait mat karo
    get().clearUnreadCount(chatId);
 
    try {
      const { data } = await API.get(`/chat/${chatId}`);
      set({ singleChat: data });
 
      // ✅ Messages seen mark karo backend mein bhi
      get().markAsSeen(chatId);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to fetch chats");
    } finally {
      set({ isSingleChatLoading: false });
    }
  },
 
  sendMessage: async (payload: CreateMessageType) => {
    set({ isSendingMsg: true });
    const { chatId, replyTo, content, image } = payload;
    const { user } = useAuth.getState();
 
    if (!chatId || !user?._id) return;
 
    const tempUserId = generateUUID();
 
    const tempMessage = {
      _id: tempUserId,
      chatId,
      content: content || "",
      image: image || null,
      sender: user,
      replyTo: replyTo || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "sending...",
      reactions: [],
    };
 
    set((state) => {
      if (state.singleChat?.chat?._id !== chatId) return state;
      return {
        singleChat: {
          ...state.singleChat,
          messages: [...state.singleChat.messages, tempMessage],
        },
      };
    });
 
    try {
      const { data } = await API.post("/chat/message/send", {
        chatId,
        content,
        image,
        replyToId: replyTo?._id,
      });
      const { userMessage } = data;
      set((state) => {
        if (!state.singleChat) return state;
        return {
          singleChat: {
            ...state.singleChat,
            messages: state.singleChat.messages.map((msg) =>
              msg._id === tempUserId ? userMessage : msg
            ),
          },
        };
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send message");
    } finally {
      set({ isSendingMsg: false });
    }
  },
 
  addNewChat: (newChat: ChatType) => {
    set((state) => {
      const existingChatIndex = state.chats.findIndex(
        (c) => c._id === newChat._id
      );
      if (existingChatIndex !== -1) {
        return {
          chats: [newChat, ...state.chats.filter((c) => c._id !== newChat._id)],
        };
      } else {
        return { chats: [newChat, ...state.chats] };
      }
    });
  },
 
  updateChatLastMessage: (chatId, lastMessage) => {
    set((state) => {
      const chat = state.chats.find((c) => c._id === chatId);
      if (!chat) return state;
 
      const { user } = useAuth.getState();
      const isOwnMessage = lastMessage?.sender?._id === user?._id;
 
      // ✅ Agar chat abhi open hai to badge mat badhaao
      const isChatOpen = state.singleChat?.chat?._id === chatId;
 
      let unreadCount = chat.unreadCount || 0;
      if (!isOwnMessage && !isChatOpen) {
        unreadCount += 1;
      }
 
      return {
        chats: [
          { ...chat, lastMessage, unreadCount },
          ...state.chats.filter((c) => c._id !== chatId),
        ],
      };
    });
  },
 
  addNewMessage: (chatId, message) => {
    const state = get();
    const chat = state.singleChat;
 
    if (chat?.chat._id === chatId) {
      set({
        singleChat: {
          chat: chat.chat,
          messages: [...chat.messages, message],
        },
      });
 
      // ✅ Naya message aaya aur chat open hai — turant seen mark karo
      get().markAsSeen(chatId);
    }
  },
 
  removeChat: (chatId: string) => {
    set((state) => ({
      chats: state.chats.filter((c) => c._id !== chatId),
      singleChat:
        state.singleChat?.chat._id === chatId ? null : state.singleChat,
    }));
  },
 
  reactToMessage: async (messageId: string, emoji: string) => {
    const { user } = useAuth.getState();
    if (!user?._id) return;
 
    set((state) => {
      if (!state.singleChat) return state;
      return {
        singleChat: {
          ...state.singleChat,
          messages: state.singleChat.messages.map((msg) => {
            if (msg._id !== messageId) return msg;
 
            const existing = (msg.reactions || []).find(
              (r: any) => (r.user?._id || r.user) === user._id
            );
 
            let newReactions;
            if (existing) {
              if (existing.emoji === emoji) {
                newReactions = (msg.reactions || []).filter(
                  (r: any) => (r.user?._id || r.user) !== user._id
                );
              } else {
                newReactions = (msg.reactions || []).map((r: any) =>
                  (r.user?._id || r.user) === user._id
                    ? { ...r, emoji }
                    : r
                );
              }
            } else {
              newReactions = [
                ...(msg.reactions || []),
                { user: { _id: user._id, name: user.name }, emoji },
              ];
            }
 
            return { ...msg, reactions: newReactions };
          }),
        },
      };
    });
 
    try {
      await API.post("/chat/message/react", { messageId, emoji });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to react");
    }
  },
 
  updateMessageReactions: (messageId: string, reactions: any[]) => {
    set((state) => {
      if (!state.singleChat) return state;
      return {
        singleChat: {
          ...state.singleChat,
          messages: state.singleChat.messages.map((msg) =>
            msg._id === messageId ? { ...msg, reactions } : msg
          ),
        },
      };
    });
  },
 
  markAsSeen: async (chatId: string) => {
    try {
      await API.post(`/chat/${chatId}/seen`);
      get().clearUnreadCount(chatId);
    } catch (error: any) {
      console.error("Failed to mark messages as seen:", error);
    }
  },
 
  updateMessagesSeenStatus: (messageIds: string[]) => {
    set((state) => {
      if (!state.singleChat) return state;
      const idSet = new Set(messageIds);
      return {
        singleChat: {
          ...state.singleChat,
          messages: state.singleChat.messages.map((msg) =>
            idSet.has(msg._id) ? { ...msg, status: "seen" } : msg
          ),
        },
      };
    });
  },
 
  updateMessageDelivered: (messageId: string) => {
    set((state) => {
      if (!state.singleChat) return state;
      return {
        singleChat: {
          ...state.singleChat,
          messages: state.singleChat.messages.map((msg) => {
            if (msg._id !== messageId) return msg;
            if (msg.status === "seen") return msg;
            return { ...msg, status: "delivered" };
          }),
        },
      };
    });
  },
 
  clearUnreadCount: (chatId: string) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c._id === chatId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },

  // ✅ Group avatar/name/description update hone par chats list aur open chat — dono jagah sync karo
  updateGroupInfo: (chatId, updates) => {
    set((state) => ({
      chats: state.chats.map((c) =>
        c._id === chatId ? { ...c, ...updates } : c
      ),
      singleChat:
        state.singleChat?.chat._id === chatId
          ? {
              ...state.singleChat,
              chat: { ...state.singleChat.chat, ...updates },
            }
          : state.singleChat,
    }));
  },
}));