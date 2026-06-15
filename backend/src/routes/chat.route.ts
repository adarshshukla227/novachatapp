import { Router } from "express";
import { passportAuthenticateJwt } from "../config/passport.config";
import {
  createChatController,
  getSingleChatController,
  getUserChatsController,
  getGroupMembersController,
  leaveGroupController,
} from "../controllers/chat.controller";
import {
  sendMessageController,
  reactMessageController,
  markSeenController, // NEW
} from "../controllers/message.controller";
 
const chatRoutes = Router()
  .use(passportAuthenticateJwt)
  .post("/create", createChatController)
  .post("/message/send", sendMessageController)
  .post("/message/react", reactMessageController)
  .get("/all", getUserChatsController)
  .get("/:id/members", getGroupMembersController)
  .post("/:id/leave", leaveGroupController)
  .post("/:chatId/seen", markSeenController) // NEW — mark all messages in chat as seen
  .get("/:id", getSingleChatController);     // ye LAST mein rakho
 
export default chatRoutes;
 