import { io, Socket } from "socket.io-client";
import { create } from "zustand";

// ✅ Always use env variable - works for both dev and production
const BASE_URL = import.meta.env.VITE_API_URL;

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
    console.log(socket, "socket");
    if (socket?.connected) return;

    const newSocket = io(BASE_URL, {
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
      socket.disconnect();
      set({ socket: null });
    }
  },
}));