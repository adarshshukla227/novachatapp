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
 
  const chatsWithUnread = await Promise.all(
    chats.map(async (chat) => {
      const unreadCount = await MessageModel.countDocuments({
        chatId: chat._id,
        sender: { $ne: userId },
        status: { $ne: "seen" },
      });
 
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
 
// ─── Get chat by ID (used by socket calling logic) ───────────────────────
export const getChatById = async (chatId: string) => {
  const chat = await ChatModel.findById(chatId).populate(
    "participants",
    "name avatar _id"
  );
  return chat;
};
 
// ─── Missed call message (ring timeout — koi nahi utha) ──────────────────
export const createMissedCallMessageService = async (
  chatId: string,
  callerId: string,
  callType: "voice" | "video"
) => {
  const content =
    callType === "video" ? "📹 Missed video call" : "📞 Missed voice call";
 
  const message = await MessageModel.create({
    chatId,
    sender: callerId,
    content,
    messageType: "call",
    callType,
    callStatus: "missed",
    callDuration: 0,
    status: "sent",
  });
 
  const populatedMessage = await message.populate("sender", "name avatar");
 
  const chat = await ChatModel.findByIdAndUpdate(
    chatId,
    { lastMessage: message._id },
    { new: true }
  ).populate("participants", "_id");
 
  return { message: populatedMessage, chat };
};
 
// ─── Call message — connected / offline / declined ────────────────────────
export const createCallMessageService = async (
  chatId: string,
  senderId: string,
  callType: "voice" | "video",
  callStatus: "connected" | "missed" | "offline" | "declined",
  callDuration: number = 0
) => {
  // Duration text banana
  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;
  const durationText =
    callDuration > 0
      ? mins > 0
        ? `${mins}m ${secs}s`
        : `${secs}s`
      : null;
 
  // Content text — Instagram jaisa
  const icon = callType === "video" ? "📹" : "📞";
  let content = "";
 
  if (callStatus === "connected") {
    content = `${icon} ${callType === "video" ? "Video" : "Voice"} call ended${durationText ? ` • ${durationText}` : ""}`;
  } else if (callStatus === "missed") {
    content = `${icon} Missed ${callType} call`;
  } else if (callStatus === "offline") {
    content = `${icon} Called — User was offline`;
  } else if (callStatus === "declined") {
    content = `${icon} ${callType === "video" ? "Video" : "Voice"} call declined`;
  }
 
  const message = await MessageModel.create({
    chatId,
    sender: senderId,
    content,
    messageType: "call",
    callType,
    callStatus,
    callDuration,
    status: "sent",
  });
 
  const populatedMessage = await MessageModel.findById(message._id)
    .populate("sender", "name avatar")
    .lean();
 
  const chat = await ChatModel.findByIdAndUpdate(
    chatId,
    { lastMessage: message._id },
    { new: true }
  ).populate("participants", "_id");
 
  return { message: populatedMessage, chat };
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
 
export const updateGroupInfoService = async (
  chatId: string,
  userId: string,
  data: { groupName?: string; groupDescription?: string; groupAvatar?: string }
) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    isGroup: true,
    groupAdmin: userId,
  });
 
  if (!chat) throw new NotFoundException("Group not found or you are not admin");
 
  if (data.groupName) chat.groupName = data.groupName;
  if (data.groupDescription !== undefined) chat.groupDescription = data.groupDescription;
  if (data.groupAvatar) chat.groupAvatar = data.groupAvatar;
 
  await chat.save();
  return chat.populate("participants", "name avatar");
};
 
export const addGroupMemberService = async (
  chatId: string,
  userId: string,
  memberId: string
) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    isGroup: true,
    groupAdmin: userId,
  });
 
  if (!chat) throw new NotFoundException("Group not found or you are not admin");
 
  const alreadyMember = chat.participants.some(
    (p) => p.toString() === memberId
  );
  if (alreadyMember) throw new BadRequestException("User is already a member");
 
  const user = await UserModel.findById(memberId);
  if (!user) throw new NotFoundException("User not found");
 
  chat.participants.push(user._id as any);
  await chat.save();
 
  return chat.populate("participants", "name avatar");
};
 
export const clearChatService = async (chatId: string, userId: string) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: { $in: [userId] },
  });
 
  if (!chat) throw new NotFoundException("Chat not found");
 
  await MessageModel.deleteMany({ chatId });
 
  chat.lastMessage = null as any;
  await chat.save();
 
  return true;
};
 