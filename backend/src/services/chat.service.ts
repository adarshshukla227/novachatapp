import { emitNewChatToParticpants } from "../lib/socket";
import ChatModel from "../models/chat.model";
import MessageModel from "../models/message.model";
import UserModel from "../models/user.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
 
export const createChatService = async (
  userId: string,
  body: {
    participantId?: string;
    isGroup?: boolean;
    participants?: string[];
    groupName?: string;
  }
) => {
  const { participantId, isGroup, participants, groupName } = body;
 
  let chat;
  let allParticipantIds: string[] = [];
 
  if (isGroup && participants?.length && groupName) {
    allParticipantIds = [userId, ...participants];
    chat = await ChatModel.create({
      participants: allParticipantIds,
      isGroup: true,
      groupName,
      groupAdmin: userId,
      createdBy: userId,
    });
  } else if (participantId) {
    const otherUser = await UserModel.findById(participantId);
    if (!otherUser) throw new NotFoundException("User not found");
 
    allParticipantIds = [userId, participantId];
    const existingChat = await ChatModel.findOne({
      participants: {
        $all: allParticipantIds,
        $size: 2,
      },
    }).populate("participants", "name avatar");
 
    if (existingChat) return existingChat;
 
    chat = await ChatModel.create({
      participants: allParticipantIds,
      isGroup: false,
      createdBy: userId,
    });
  }
 
  const populatedChat = await chat?.populate("participants", "name avatar isAI");
  const particpantIdStrings = populatedChat?.participants?.map((p) =>
    p._id?.toString()
  );
 
  emitNewChatToParticpants(particpantIdStrings, populatedChat);
 
  return chat;
};
 
// ─── UPDATED: includes unreadCount per chat ────────────────────────────────────
export const getUserChatsService = async (userId: string) => {
  const chats = await ChatModel.find({
    participants: { $in: [userId] },
  })
    .populate("participants", "name avatar")
    .populate({
      path: "lastMessage",
      populate: { path: "sender", select: "name avatar" },
    })
    .sort({ updatedAt: -1 });
 
  // For each chat, count messages NOT sent by this user that are not "seen"
  const chatsWithUnread = await Promise.all(
    chats.map(async (chat) => {
      const unreadCount = await MessageModel.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        status: { $ne: "seen" },
      });
 
      // toObject so we can attach a plain extra field
      const chatObj = chat.toObject() as any;
      chatObj.unreadCount = unreadCount;
      return chatObj;
    })
  );
 
  return chatsWithUnread;
};
 
export const getSingleChatService = async (chatId: string, userId: string) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: { $in: [userId] },
  }).populate("participants", "name avatar");
 
  if (!chat)
    throw new BadRequestException(
      "Chat not found or you are not authorized to view this chat"
    );
 
  const messages = await MessageModel.find({ chatId })
    .populate("sender", "name avatar")
    .populate({
      path: "replyTo",
      select: "content image sender",
      populate: { path: "sender", select: "name avatar" },
    })
    .sort({ createdAt: 1 });
 
  return { chat, messages };
};
 
export const validateChatParticipant = async (
  chatId: string,
  userId: string
) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: { $in: [userId] },
  });
  if (!chat) throw new BadRequestException("User not a participant in chat");
  return chat;
};
 
export const getGroupMembersService = async (
  chatId: string,
  userId: string
) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: { $in: [userId] },
    isGroup: true,
  })
    .populate("participants", "name avatar _id")
    .populate("groupAdmin", "_id");
 
  if (!chat) throw new NotFoundException("Group not found");
 
  const adminId = (chat.groupAdmin as any)?._id?.toString() || chat.groupAdmin?.toString();
 
  const members = (chat.participants as any[]).map((member: any) => ({
    _id: member._id,
    name: member.name,
    avatar: member.avatar,
    isAdmin: member._id.toString() === adminId,
  }));
 
  members.sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin));
 
  return members;
};
 
export const leaveGroupService = async (chatId: string, userId: string) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: { $in: [userId] },
    isGroup: true,
  });
 
  if (!chat) throw new NotFoundException("Group not found");
 
  chat.participants = chat.participants.filter(
    (p) => p.toString() !== userId.toString()
  );
 
  if (chat.groupAdmin?.toString() === userId.toString()) {
    chat.groupAdmin =
      chat.participants.length > 0 ? chat.participants[0] : null;
  }
 
  if (chat.participants.length === 0) {
    await ChatModel.findByIdAndDelete(chatId);
    return { deleted: true };
  }
 
  await chat.save();
  return { deleted: false };
};
 