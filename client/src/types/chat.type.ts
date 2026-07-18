import type { UserType } from "./auth.type";
 
export type ChatType = {
  _id: string;
  lastMessage: MessageType;
  participants: UserType[];
  isGroup: boolean;
  isAiChat: boolean;
  createdBy: string;
  groupName?: string;
  groupAdmin?: string;
  groupDescription?: string;
  groupAvatar?: string;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
};
 
export type ReactionType = {
  user: UserType | string;
  emoji: string;
};
 
export type MessageType = {
  _id: string;
  content: string | null;
  image: string | null;
  sender: UserType | null;
  replyTo: MessageType | null;
  chatId: string;
  createdAt: string;
  updatedAt: string;
  status?: "sent" | "delivered" | "seen" | "sending" | "sending..." | string;
  streaming?: boolean;
  reactions?: ReactionType[];
};
 
export type CreateChatType = {
  participantId?: string;
  isGroup?: boolean;
  participants?: string[];
  groupName?: string;
};
 
export type CreateMessageType = {
  chatId: string | null;
  content?: string;
  image?: string;
  replyTo?: MessageType | null;
};

// ✅ Assignment types
export type AssignmentType = {
  _id: string;
  chatId: string;
  title: string;
  subject: string;
  deadline: string;
  createdBy: UserType;
  completedBy: UserType[];
  createdAt: string;
  updatedAt: string;
};