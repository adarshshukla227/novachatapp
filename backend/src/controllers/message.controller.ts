import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { sendMessageSchema, reactMessageSchema, markSeenSchema } from "../validators/message.validator";
import { HTTPSTATUS } from "../config/http.config";
import { sendMessageService, reactMessageService, markMessagesAsSeenService } from "../services/message.service";
 
export const sendMessageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = sendMessageSchema.parse(req.body);
 
    const result = await sendMessageService(userId, body);
 
    return res.status(HTTPSTATUS.OK).json({
      message: "Message sent successfully",
      ...result,
    });
  }
);
 
// ─── React to a message ───────────────────────────────────────────────
export const reactMessageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = reactMessageSchema.parse(req.body);
 
    const result = await reactMessageService(userId, body);
 
    return res.status(HTTPSTATUS.OK).json({
      message: "Reaction updated successfully",
      ...result,
    });
  }
);
 
// ─── NEW: Mark messages as seen ─────────────────────────────────────────
export const markSeenController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { chatId } = markSeenSchema.parse(req.params);
 
    const result = await markMessagesAsSeenService(userId, chatId);
 
    return res.status(HTTPSTATUS.OK).json({
      message: "Messages marked as seen",
      ...result,
    });
  }
);