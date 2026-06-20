import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { Env } from "../config/env.config";
import {
  validateChatParticipant,
  getChatById,
  createMissedCallMessageService,
} from "../services/chat.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let io: Server | null = null;

const onlineUsers = new Map<string, string>();

// ─── Call session tracking ────────────────────────────────────────────────
type ParticipantStatus = "ringing" | "joined" | "declined" | "left";

interface CallParticipant {
  userId: string;
  status: ParticipantStatus;
}

interface CallSession {
  callId: string;
  chatId: string;
  type: "voice" | "video";
  initiatorId: string;
  isGroup: boolean;
  participants: Map<string, CallParticipant>;
  missedTimeout?: NodeJS.Timeout;
}

const activeCalls = new Map<string, CallSession>();
const userActiveCallId = new Map<string, string>();
const RING_TIMEOUT_MS = 30000;

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

      const decodedToken = jwt.verify(token, Env.JWT_SECRET) as { userId: string };
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

    onlineUsers.set(userId, newSocketId);
    io?.emit("online:users", Array.from(onlineUsers.keys()));
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

    // ─── Typing indicators ─────────────────────────────────────────────────
    socket.on("typing:start", (chatId: string) => {
      socket.to(`chat:${chatId}`).emit("typing:start", {
        chatId,
        userId,
      });
    });

    socket.on("typing:stop", (chatId: string) => {
      socket.to(`chat:${chatId}`).emit("typing:stop", {
        chatId,
        userId,
      });
    });
    // ──────────────────────────────────────────────────────────────────────

    // ─── Calling: initiate (works for 1-to-1 AND group) ───────────────────
    socket.on(
      "call:initiate",
      async (
        payload: { callId: string; chatId: string; type: "voice" | "video" },
        callback?: (err?: string) => void
      ) => {
        try {
          const { callId, chatId, type } = payload;

          if (userActiveCallId.has(userId)) {
            callback?.("You are already in a call");
            return;
          }

          const chat = await getChatById(chatId);
          if (!chat) {
            callback?.("Chat not found");
            return;
          }

          const isGroup = !!chat.isGroup;
          const allParticipantIds: string[] = (chat.participants as any[]).map(
            (p: any) => (p._id || p).toString()
          );
          const otherParticipantIds = allParticipantIds.filter((id) => id !== userId);

          if (otherParticipantIds.length === 0) {
            callback?.("No one to call");
            return;
          }

          const participantsMap = new Map<string, CallParticipant>();
          participantsMap.set(userId, { userId, status: "joined" });
          otherParticipantIds.forEach((id) =>
            participantsMap.set(id, { userId: id, status: "ringing" })
          );

          const session: CallSession = {
            callId,
            chatId,
            type,
            initiatorId: userId,
            isGroup,
            participants: participantsMap,
          };

          session.missedTimeout = setTimeout(() => {
            finalizeMissedCall(callId);
          }, RING_TIMEOUT_MS);

          activeCalls.set(callId, session);
          userActiveCallId.set(userId, callId);

          let anyoneOnline = false;
          for (const pid of otherParticipantIds) {
            if (onlineUsers.has(pid)) {
              anyoneOnline = true;
              io?.to(`user:${pid}`).emit("call:incoming", {
                callId,
                chatId,
                type,
                isGroup,
                initiatorId: userId,
              });
            }
          }

          if (!anyoneOnline) {
            if (session.missedTimeout) clearTimeout(session.missedTimeout);
            finalizeMissedCall(callId);
            callback?.("No one is online");
            return;
          }

          callback?.();
        } catch (error) {
          callback?.("Failed to initiate call");
        }
      }
    );

    // Participant accepts/joins
    socket.on("call:join", (payload: { callId: string }) => {
      const session = activeCalls.get(payload.callId);
      if (!session) return;

      const me = session.participants.get(userId);
      if (!me) return;

      me.status = "joined";
      userActiveCallId.set(userId, session.callId);

      const alreadyJoined = Array.from(session.participants.values())
        .filter((p) => p.status === "joined" && p.userId !== userId)
        .map((p) => p.userId);

      socket.emit("call:joined-participants", {
        callId: session.callId,
        participants: alreadyJoined,
      });

      for (const p of session.participants.values()) {
        if (p.userId !== userId) {
          io?.to(`user:${p.userId}`).emit("call:participant-joined", {
            callId: session.callId,
            userId,
          });
        }
      }
    });

    // Participant declines
    socket.on("call:decline", (payload: { callId: string }) => {
      const session = activeCalls.get(payload.callId);
      if (!session) return;

      const me = session.participants.get(userId);
      if (!me) return;
      me.status = "declined";

      for (const p of session.participants.values()) {
        if (p.userId !== userId) {
          io?.to(`user:${p.userId}`).emit("call:participant-declined", {
            callId: session.callId,
            userId,
          });
        }
      }

      maybeEndSessionIfEmpty(session);
    });

    // Participant leaves an ongoing call
    socket.on("call:leave", (payload: { callId: string }) => {
      const session = activeCalls.get(payload.callId);
      if (!session) return;

      const me = session.participants.get(userId);
      if (me) me.status = "left";
      userActiveCallId.delete(userId);

      for (const p of session.participants.values()) {
        if (p.userId !== userId) {
          io?.to(`user:${p.userId}`).emit("call:participant-left", {
            callId: session.callId,
            userId,
          });
        }
      }

      maybeEndSessionIfEmpty(session);
    });

    // ─── WebRTC signaling relay (mesh: targeted by `to`) ──────────────────
    socket.on("call:offer", (payload: { callId: string; to: string; sdp: any }) => {
      io?.to(`user:${payload.to}`).emit("call:offer", {
        callId: payload.callId,
        from: userId,
        sdp: payload.sdp,
      });
    });

    socket.on("call:answer", (payload: { callId: string; to: string; sdp: any }) => {
      io?.to(`user:${payload.to}`).emit("call:answer", {
        callId: payload.callId,
        from: userId,
        sdp: payload.sdp,
      });
    });

    socket.on(
      "call:ice-candidate",
      (payload: { callId: string; to: string; candidate: any }) => {
        io?.to(`user:${payload.to}`).emit("call:ice-candidate", {
          callId: payload.callId,
          from: userId,
          candidate: payload.candidate,
        });
      }
    );

    socket.on(
      "call:media-state",
      (payload: { callId: string; audioEnabled: boolean; videoEnabled: boolean }) => {
        const session = activeCalls.get(payload.callId);
        if (!session) return;
        for (const p of session.participants.values()) {
          if (p.userId !== userId && p.status === "joined") {
            io?.to(`user:${p.userId}`).emit("call:media-state", {
              callId: payload.callId,
              from: userId,
              audioEnabled: payload.audioEnabled,
              videoEnabled: payload.videoEnabled,
            });
          }
        }
      }
    );
    // ──────────────────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      if (onlineUsers.get(userId) === newSocketId) {
        if (userId) onlineUsers.delete(userId);

        io?.emit("online:users", Array.from(onlineUsers.keys()));

        // End any active calls involving this user
        const callId = userActiveCallId.get(userId);
        if (callId) {
          const session = activeCalls.get(callId);
          if (session) {
            const me = session.participants.get(userId);
            if (me) me.status = "left";
            userActiveCallId.delete(userId);

            for (const p of session.participants.values()) {
              if (p.userId !== userId) {
                io?.to(`user:${p.userId}`).emit("call:participant-left", {
                  callId,
                  userId,
                });
              }
            }
            maybeEndSessionIfEmpty(session);
          }
        }

        console.log("socket disconnected", {
          userId,
          newSocketId,
        });
      }
    });
  });

  // ─── Calling Helpers ─────────────────────────────────────────────────────
  async function finalizeMissedCall(callId: string) {
    const session = activeCalls.get(callId);
    if (!session) return;

    const missedUserIds: string[] = [];
    for (const p of session.participants.values()) {
      if (p.status === "ringing") {
        missedUserIds.push(p.userId);
      }
    }

    if (missedUserIds.length > 0) {
      try {
        const { message, chat } = await createMissedCallMessageService(
          session.chatId,
          session.initiatorId,
          session.type
        );

        const participantIds: string[] =
          (chat?.participants as any[])?.map((p: any) => (p._id || p).toString()) || [];

        emitNewMessageToChatRoom(session.initiatorId, session.chatId, message);
        emitLastMessageToParticipants(participantIds, session.chatId, message);
      } catch (error) {
        console.error("Failed to create missed call message:", error);
      }
    }

    for (const p of session.participants.values()) {
      io?.to(`user:${p.userId}`).emit("call:missed-summary", {
        callId,
        chatId: session.chatId,
        type: session.type,
        missedUserIds,
        initiatorId: session.initiatorId,
      });
    }

    maybeEndSessionIfEmpty(session, true);
  }

  function maybeEndSessionIfEmpty(session: CallSession, force = false) {
    const stillIn = Array.from(session.participants.values()).filter(
      (p) => p.status === "joined" || p.status === "ringing"
    );

    if (force || stillIn.length <= 1) {
      if (session.missedTimeout) clearTimeout(session.missedTimeout);
      for (const p of session.participants.values()) {
        userActiveCallId.delete(p.userId);
      }
      activeCalls.delete(session.callId);

      for (const p of session.participants.values()) {
        io?.to(`user:${p.userId}`).emit("call:ended", { callId: session.callId });
      }
    }
  }
};

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

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
  senderId: string,
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

export const emitMessageReactionToChatRoom = (
  chatId: string,
  payload: { messageId: any; reactions: any[] }
) => {
  const io = getIO();
  io.to(`chat:${chatId}`).emit("message:reaction", payload);
};

export const emitMessagesSeenToChatRoom = (
  chatId: string,
  payload: { chatId: string; messageIds: string[]; seenBy: string }
) => {
  const io = getIO();
  io.to(`chat:${chatId}`).emit("message:seen", payload);
};

export const emitMessageDeliveredToChatRoom = (
  chatId: string,
  payload: { chatId: string; messageId: string }
) => {
  const io = getIO();
  io.to(`chat:${chatId}`).emit("message:delivered", payload);
};