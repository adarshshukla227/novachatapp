import { io, Socket } from "socket.io-client";
import { create } from "zustand";

interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useSocket = create<SocketState>()((set, get) => ({
  socket: null,
  onlineUsers: [],

  connectSocket: () => {
    const { socket } = get();

    if (socket?.connected) {
      console.log("Socket already connected, skipping");
      return;
    }

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    const newSocket = io({
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    set({ socket: newSocket });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected", newSocket.id);
    });

    newSocket.on("connect_error", (error) => {
      console.log("❌ Socket connection error:", error.message);
    });

    newSocket.on("online:users", (userIds) => {
      console.log("Online users", userIds);
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null });
    }
  },
}));