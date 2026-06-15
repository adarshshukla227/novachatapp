import cloudinary from "../config/cloudinary.config";
import UserModel from "../models/user.model";
import { NotFoundException } from "../utils/app-error";
 
export const findByIdUserService = async (userId: string) => {
  return await UserModel.findById(userId);
};
 
export const getUsersService = async (userId: string) => {
  const users = await UserModel.find({ _id: { $ne: userId } }).select(
    "-password"
  );
 
  return users;
};
 
// ─── NEW: Get current user's full profile ──────────────────────────────────
export const getMyProfileService = async (userId: string) => {
  const user = await UserModel.findById(userId).select("-password");
  if (!user) throw new NotFoundException("User not found");
  return user;
};
 
// ─── NEW: Update profile — name, bio, avatar ───────────────────────────────
export const updateProfileService = async (
  userId: string,
  body: { name?: string; bio?: string; avatar?: string }
) => {
  const { name, bio, avatar } = body;
 
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundException("User not found");
 
  if (name !== undefined && name.trim()) {
    user.name = name.trim();
  }
 
  if (bio !== undefined) {
    user.bio = bio.trim();
  }
 
  // If a new avatar image (base64) is provided, upload to cloudinary
  if (avatar) {
    const uploadRes = await cloudinary.uploader.upload(avatar, {
      folder: "avatars",
    });
    user.avatar = uploadRes.secure_url;
  }
 
  await user.save();
 
  const updatedUser = await UserModel.findById(userId).select("-password");
  return updatedUser;
};
 