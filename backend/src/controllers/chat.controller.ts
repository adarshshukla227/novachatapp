import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "../config/http.config";
import { chatIdSchema, createChatSchema } from "../validators/chat.validator";
import {
  createChatService,
  getSingleChatService,
  getUserChatsService,
  getGroupMembersService,
  leaveGroupService,
  updateGroupInfoService,
  addGroupMemberService,
  clearChatService,
} from "../services/chat.service";
import cloudinary from "../config/cloudinary.config";

export const createChatController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = createChatSchema.parse(req.body);
    const chat = await createChatService(userId, body);
    return res.status(HTTPSTATUS.OK).json({
      message: "Chat created or retrieved successfully",
      chat,
    });
  }
);

export const getUserChatsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const chats = await getUserChatsService(userId);
    return res.status(HTTPSTATUS.OK).json({
      message: "User chats retrieved successfully",
      chats,
    });
  }
);

export const getSingleChatController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = chatIdSchema.parse(req.params);
    const { chat, messages } = await getSingleChatService(id, userId);
    return res.status(HTTPSTATUS.OK).json({
      message: "User chats retrieved successfully",
      chat,
      messages,
    });
  }
);

export const getGroupMembersController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = chatIdSchema.parse(req.params);
    const members = await getGroupMembersService(id, userId);
    return res.status(HTTPSTATUS.OK).json({
      message: "Group members retrieved successfully",
      members,
    });
  }
);

export const leaveGroupController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = chatIdSchema.parse(req.params);
    const result = await leaveGroupService(id, userId);
    return res.status(HTTPSTATUS.OK).json({
      message: result.deleted
        ? "Group deleted (no members left)"
        : "Left group successfully",
      ...result,
    });
  }
);

// ─── NEW: Update group info (name, description, avatar) ──────────────────────
export const updateGroupInfoController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = chatIdSchema.parse(req.params);
    const { groupName, groupDescription, groupAvatar } = req.body;

    let avatarUrl: string | undefined;

    if (groupAvatar && groupAvatar.startsWith("data:")) {
      const uploaded = await cloudinary.uploader.upload(groupAvatar, {
        folder: "group_avatars",
      });
      avatarUrl = uploaded.secure_url;
    }

    const chat = await updateGroupInfoService(id, userId, {
      groupName,
      groupDescription,
      groupAvatar: avatarUrl,
    });

    return res.status(HTTPSTATUS.OK).json({
      message: "Group info updated successfully",
      chat,
    });
  }
);

// ─── NEW: Add member to group ─────────────────────────────────────────────────
export const addGroupMemberController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = chatIdSchema.parse(req.params);
    const { memberId } = req.body;

    const chat = await addGroupMemberService(id, userId, memberId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Member added successfully",
      chat,
    });
  }
);

// ─── NEW: Clear chat (delete all messages) ────────────────────────────────────
export const clearChatController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id } = chatIdSchema.parse(req.params);

    await clearChatService(id, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Chat cleared successfully",
    });
  }
);