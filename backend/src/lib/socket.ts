import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { Env } from "../config/env.config";
import { validateChatParticipant } from "../services/chat.service";
 
interface AuthenticatedSocket extends Socket {
  userId?: string;
}
 
let io: Server | null = null;
 
const onlineUsers = new Map<string, string>();
 
export const initializeSocket = (httpServer: HTTPServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: Env.FRONTEND_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
 
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
 
      if (!rawCookie) return next(new Error("Unauthorized"));
 
      const cookies = rawCookie.split(";").reduce((acc: Record<string, string>, pair) => {
        const [key, value] = pair.trim().split("=");
        acc[key] = value;
        return acc;
      }, {});
 
      const token = cookies["accessToken"];
      if (!token) return next(new Error("Unauthorized"));
 
      const decodedToken = jwt.verify(token, Env.JWT_SECRET) as {
        userId: string;
      };
      if (!decodedToken) return next(new Error("Unauthorized"));
 
      socket.userId = decodedToken.userId;
      next();
    } catch (error) {
      next(new Error("Internal server error"));
    }
  });
 
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const newSocketId = socket.id;
    if (!socket.userId) {
      socket.disconnect(true);
      return;
    }
 
    //register socket for the user
    onlineUsers.set(userId, newSocketId);
 
    //BroadCast online users to all socket
    io?.emit("online:users", Array.from(onlineUsers.keys()));
 
    //create personnal room for user
    socket.join(`user:${userId}`);
 
    socket.on(
      "chat:join",
      async (chatId: string, callback?: (err?: string) => void) => {
        try {
          await validateChatParticipant(chatId, userId);
          socket.join(`chat:${chatId}`);
          console.log(`User ${userId} join room chat:${chatId}`);
 
          callback?.();
        } catch (error) {
          callback?.("Error joining chat");
        }
      }
    );
 
    socket.on("chat:leave", (chatId: string) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
        console.log(`User ${userId} left room chat:${chatId}`);
      }
    });
 
    socket.on("disconnect", () => {
      if (onlineUsers.get(userId) === newSocketId) {
        if (userId) onlineUsers.delete(userId);
 
        io?.emit("online:users", Array.from(onlineUsers.keys()));
 
        console.log("socket disconnected", {
          userId,
          newSocketId,
        });
      }
    });
  });
};
 
function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
 
// ─── NEW: Check if a user is currently online ──────────────────────────────────
export const isUserOnline = (userId: string): boolean => {
  return onlineUsers.has(userId.toString());
};
 
export const emitNewChatToParticpants = (
  participantIds: string[] = [],
  chat: any
) => {
  const io = getIO();
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit("chat:new", chat);
  }
};
 
export const emitNewMessageToChatRoom = (
  senderId: string, //userId that sent the message
  chatId: string,
  message: any
) => {
  const io = getIO();
  const senderSocketId = onlineUsers.get(senderId?.toString());
 
  console.log(senderId, "senderId");
  console.log(senderSocketId, "sender socketid exist");
  console.log("All online users:", Object.fromEntries(onlineUsers));
 
  if (senderSocketId) {
    io.to(`chat:${chatId}`).except(senderSocketId).emit("message:new", message);
  } else {
    io.to(`chat:${chatId}`).emit("message:new", message);
  }
};
 
export const emitLastMessageToParticipants = (
  participantIds: string[],
  chatId: string,
  lastMessage: any
) => {
  const io = getIO();
  const payload = { chatId, lastMessage };
 
  for (const participantId of participantIds) {
    io.to(`user:${participantId}`).emit("chat:update", payload);
  }
};
 
// ─── Emit reaction update to everyone in the chat room ────────────────────
export const emitMessageReactionToChatRoom = (
  chatId: string,
  payload: { messageId: any; reactions: any[] }
) => {
  const io = getIO();
  io.to(`chat:${chatId}`).emit("message:reaction", payload);
};
 
// ─── Emit "messages seen" update to everyone in the chat room ─────────────────
export const emitMessagesSeenToChatRoom = (
  chatId: string,
  payload: { chatId: string; messageIds: string[]; seenBy: string }
) => {
  const io = getIO();
  io.to(`chat:${chatId}`).emit("message:seen", payload);
};
 
// ─── NEW: Emit "message delivered" update to everyone in the chat room ────────
// Fired right after sending, if the receiver(s) are online — single -> double
// grey tick for the sender.
export const emitMessageDeliveredToChatRoom = (
  chatId: string,
  payload: { chatId: string; messageId: string }
) => {
  const io = getIO();
  io.to(`chat:${chatId}`).emit("message:delivered", payload);
};