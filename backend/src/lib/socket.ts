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

// Helper: always normalize any id-like value to a plain string
const toIdString = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val._id) return val._id.toString();
  if (val.toString) return val.toString();
  return String(val);
};

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

      socket.userId = toIdString(decodedToken.userId);
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

    console.log(`[socket] connected: userId=${userId} socketId=${newSocketId}`);
    console.log(`[socket] onlineUsers now:`, Array.from(onlineUsers.entries()));

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
      socket.to(`chat:${chatId}`).emit("typing:start", { chatId, userId });
    });

    socket.on("typing:stop", (chatId: string) => {
      socket.to(`chat:${chatId}`).emit("typing:stop", { chatId, userId });
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
          console.log(`[call:initiate] from=${userId} chatId=${chatId} type=${type} callId=${callId}`);

          if (userActiveCallId.has(userId)) {
            console.log(`[call:initiate] BLOCKED — caller ${userId} already in a call`);
            callback?.("You are already in a call");
            return;
          }

          const chat = await getChatById(chatId);
          if (!chat) {
            console.log(`[call:initiate] FAILED — chat ${chatId} not found`);
            callback?.("Chat not found");
            return;
          }

          const isGroup = !!chat.isGroup;
          const allParticipantIds: string[] = (chat.participants as any[]).map(toIdString);
          console.log(`[call:initiate] chat participants (raw):`, allParticipantIds);
          console.log(`[call:initiate] caller userId:`, userId);

          const otherParticipantIds = allParticipantIds.filter((id) => id !== userId);
          console.log(`[call:initiate] otherParticipantIds:`, otherParticipantIds);

          if (otherParticipantIds.length === 0) {
            console.log(`[call:initiate] FAILED — no other participants (mismatch likely!)`);
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
            console.log(`[call:initiate] RING_TIMEOUT hit for callId=${callId}`);
            finalizeMissedCall(callId);
          }, RING_TIMEOUT_MS);

          activeCalls.set(callId, session);
          userActiveCallId.set(userId, callId);

          let anyoneOnline = false;
          for (const pid of otherParticipantIds) {
            const isOnline = onlineUsers.has(pid);
            console.log(`[call:initiate] checking participant ${pid} -> online=${isOnline}`);
            if (isOnline) {
              anyoneOnline = true;
              console.log(`[call:initiate] EMITTING call:incoming to user:${pid}`);
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
            console.log(`[call:initiate] NOBODY ONLINE among:`, otherParticipantIds);
            if (session.missedTimeout) clearTimeout(session.missedTimeout);
            finalizeMissedCall(callId);
            callback?.("No one is online");
            return;
          }

          callback?.();
        } catch (error) {
          console.error(`[call:initiate] ERROR:`, error);
          callback?.("Failed to initiate call");
        }
      }
    );

    // Participant accepts/joins
    socket.on("call:join", (payload: { callId: string }) => {
      console.log(`[call:join] userId=${userId} callId=${payload.callId}`);
      const session = activeCalls.get(payload.callId);
      if (!session) {
        console.log(`[call:join] FAILED — no session found for callId=${payload.callId}`);
        return;
      }

      const me = session.participants.get(userId);
      if (!me) {
        console.log(`[call:join] FAILED — userId=${userId} not in session participants`);
        return;
      }

      me.status = "joined";
      userActiveCallId.set(userId, session.callId);

      if (session.missedTimeout) {
        clearTimeout(session.missedTimeout);
        session.missedTimeout = undefined;
      }

      const alreadyJoined = Array.from(session.participants.values())
        .filter((p) => p.status === "joined" && p.userId !== userId)
        .map((p) => p.userId);

      console.log(`[call:join] alreadyJoined for new joiner ${userId}:`, alreadyJoined);

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

      // Notify the original caller specifically that the call was accepted
      // (1-to-1 caller waits on "call:accepted" to flip from outgoing -> ongoing)
      if (session.initiatorId !== userId) {
        io?.to(`user:${session.initiatorId}`).emit("call:accepted", {
          callId: session.callId,
        });
      }
    });

    // Participant declines
    socket.on("call:decline", (payload: { callId: string }) => {
      console.log(`[call:decline] userId=${userId} callId=${payload.callId}`);
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
      console.log(`[call:leave] userId=${userId} callId=${payload.callId}`);
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
      console.log(`[call:offer] from=${userId} to=${payload.to} callId=${payload.callId}`);
      io?.to(`user:${payload.to}`).emit("call:offer", {
        callId: payload.callId,
        from: userId,
        sdp: payload.sdp,
      });
    });

    socket.on("call:answer", (payload: { callId: string; to: string; sdp: any }) => {
      console.log(`[call:answer] from=${userId} to=${payload.to} callId=${payload.callId}`);
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

        console.log("socket disconnected", { userId, newSocketId });
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

    console.log(`[finalizeMissedCall] callId=${callId} missedUserIds=`, missedUserIds);

    if (missedUserIds.length > 0) {
      try {
        const { message, chat } = await createMissedCallMessageService(
          session.chatId,
          session.initiatorId,
          session.type
        );

        const participantIds: string[] =
          (chat?.participants as any[])?.map(toIdString) || [];

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