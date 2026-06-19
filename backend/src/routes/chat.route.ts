import { Router } from "express";
import { passportAuthenticateJwt } from "../config/passport.config";
import {
  createChatController,
  getSingleChatController,
  getUserChatsController,
  getGroupMembersController,
  leaveGroupController,
  updateGroupInfoController,
  addGroupMemberController,
  clearChatController,
} from "../controllers/chat.controller";
import {
  sendMessageController,
  reactMessageController,
  markSeenController,
} from "../controllers/message.controller";

const chatRoutes = Router()
  .use(passportAuthenticateJwt)
  .post("/create", createChatController)
  .post("/message/send", sendMessageController)
  .post("/message/react", reactMessageController)
  .get("/all", getUserChatsController)
  .get("/:id/members", getGroupMembersController)
  .post("/:id/leave", leaveGroupController)
  .patch("/:id/group-info", updateGroupInfoController)
  .post("/:id/add-member", addGroupMemberController)
  .delete("/:id/clear", clearChatController)
  .post("/:chatId/seen", markSeenController)
  .get("/:id", getSingleChatController); // ye LAST mein rakho

export default chatRoutes;