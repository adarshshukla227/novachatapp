import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "../config/http.config";
import {
  getUsersService,
  getMyProfileService,
  updateProfileService,
} from "../services/user.service";
import { updateProfileSchema } from "../validators/user.validator";
 
export const getUsersController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
 
    const users = await getUsersService(userId);
 
    return res.status(HTTPSTATUS.OK).json({
      message: "Users retrieved successfully",
      users,
    });
  }
);
 
// ─── NEW: Get my profile ────────────────────────────────────────────────────
export const getMyProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
 
    const user = await getMyProfileService(userId);
 
    return res.status(HTTPSTATUS.OK).json({
      message: "Profile retrieved successfully",
      user,
    });
  }
);
 
// ─── NEW: Update my profile ─────────────────────────────────────────────────
export const updateProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = updateProfileSchema.parse(req.body);
 
    const user = await updateProfileService(userId, body);
 
    return res.status(HTTPSTATUS.OK).json({
      message: "Profile updated successfully",
      user,
    });
  }
);
 