import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.config";
import ChatModel from "../models/chat.model";
import MessageModel from "../models/message.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  emitLastMessageToParticipants,
  emitNewMessageToChatRoom,
  emitMessageReactionToChatRoom,
  emitMessagesSeenToChatRoom,
  emitMessageDeliveredToChatRoom,
  isUserOnline,
} from "../lib/socket";
import UserModel from "../models/user.model";
 
export const sendMessageService = async (
  userId: string,
  body: {
    chatId: string;
    content?: string;
    image?: string;
    replyToId?: string;
  }
) => {
  const { chatId, content, image, replyToId } = body;
 
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: {
      $in: [userId],
    },
  });
  if (!chat) throw new BadRequestException("Chat not found or unauthorized");
 
  if (replyToId) {
    const replyMessage = await MessageModel.findOne({
      _id: replyToId,
      chatId,
    });
    if (!replyMessage) throw new NotFoundException("Reply message not found");
  }
 
  let imageUrl;
 
  if (image) {
    //upload the image to cloudinary
    const uploadRes = await cloudinary.uploader.upload(image);
    imageUrl = uploadRes.secure_url;
  }
 
  // ─── NEW: Check if any OTHER participant is currently online ────────────────
  // If yes, the message can immediately be marked "delivered" instead of "sent".
  const otherParticipantIds = chat.participants
    .map((id) => id.toString())
    .filter((id) => id !== userId.toString());
 
  const someoneOnline = otherParticipantIds.some((id) => isUserOnline(id));
  const initialStatus = someoneOnline ? "delivered" : "sent";
 
  const newMessage = await MessageModel.create({
    chatId,
    sender: userId,
    content,
    image: imageUrl,
    replyTo: replyToId || null,
    status: initialStatus, // NEW — sent or delivered based on receiver presence
  });
 
  await newMessage.populate([
    { path: "sender", select: "name avatar" },
    {
      path: "replyTo",
      select: "content image sender",
      populate: {
        path: "sender",
        select: "name avatar",
      },
    },
  ]);
 
  chat.lastMessage = newMessage._id as mongoose.Types.ObjectId;
  await chat.save();
 
  //websocket emit the new Message to the chat room
  emitNewMessageToChatRoom(userId, chatId, newMessage);
 
  //websocket emit the lastmessage to members (personnal room user)
  const allParticipantIds = chat.participants.map((id) => id.toString());
  emitLastMessageToParticipants(allParticipantIds, chatId, newMessage);
 
  // ─── NEW: If delivered immediately, notify the sender so their tick updates ──
  if (someoneOnline) {
    emitMessageDeliveredToChatRoom(chatId, {
      chatId,
      messageId: (newMessage._id as mongoose.Types.ObjectId).toString(),
    });
  }
 
  return {
    userMessage: newMessage,
    chat,
  };
};
 
// ─── React to a message (toggle emoji reaction) ──────────────────────────
export const reactMessageService = async (
  userId: string,
  body: { messageId: string; emoji: string }
) => {
  const { messageId, emoji } = body;
 
  const message = await MessageModel.findById(messageId);
  if (!message) throw new NotFoundException("Message not found");
 
  const chat = await ChatModel.findOne({
    _id: message.chatId,
    participants: { $in: [userId] },
  });
  if (!chat) throw new BadRequestException("Unauthorized");
 
  const existingIndex = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );
 
  if (existingIndex !== -1) {
    const existing = message.reactions[existingIndex];
    if (existing.emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions[existingIndex].emoji = emoji;
    }
  } else {
    message.reactions.push({
      user: new mongoose.Types.ObjectId(userId),
      emoji,
    });
  }
 
  await message.save();
  await message.populate("reactions.user", "name avatar");
 
  emitMessageReactionToChatRoom(message.chatId.toString(), {
    messageId: message._id,
    reactions: message.reactions,
  });
 
  return { reactions: message.reactions };
};
 
// ─── Mark all messages in a chat as "seen" by the current user ───────────────
export const markMessagesAsSeenService = async (
  userId: string,
  chatId: string
) => {
  const chat = await ChatModel.findOne({
    _id: chatId,
    participants: { $in: [userId] },
  });
  if (!chat) throw new BadRequestException("Chat not found or unauthorized");
 
  const unseenMessages = await MessageModel.find({
    chatId,
    sender: { $ne: userId },
    status: { $ne: "seen" },
  }).select("_id sender");
 
  if (unseenMessages.length === 0) {
    return { updatedCount: 0, messageIds: [] };
  }
 
  const messageIds = unseenMessages.map((m) => m._id);
 
  await MessageModel.updateMany(
    { _id: { $in: messageIds } },
    { $set: { status: "seen" } }
  );
 
  emitMessagesSeenToChatRoom(chatId, {
    chatId,
    messageIds: messageIds.map((id) => (id as mongoose.Types.ObjectId).toString()),
    seenBy: userId,
  });
 
  return { updatedCount: messageIds.length, messageIds };
};