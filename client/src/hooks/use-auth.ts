import { API } from "@/lib/axios-client";
import type { LoginType, RegisterType, UpdateProfileType, UserType } from "@/types/auth.type";
import { toast } from "sonner";
import { create } from "zustand";
//import { persist } from "zustand/middleware";
import { useSocket } from "./use-socket";
 
interface AuthState {
  user: UserType | null;
  isLoggingIn: boolean;
  isSigningUp: boolean;
  isAuthStatusLoading: boolean;
  isUpdatingProfile: boolean; // NEW
 
  register: (data: RegisterType) => void;
  login: (data: LoginType) => void;
  logout: () => void;
  isAuthStatus: () => void;
 
  // NEW
  updateProfile: (data: UpdateProfileType) => Promise<boolean>;
}
 
//Without Persist
export const useAuth = create<AuthState>()((set) => ({
  user: null,
  isSigningUp: false,
  isLoggingIn: false,
  isAuthStatusLoading: false,
  isUpdatingProfile: false,
 
  register: async (data: RegisterType) => {
    set({ isSigningUp: true });
    try {
      const response = await API.post("/auth/register", data);
      set({ user: response.data.user });
      useSocket.getState().connectSocket();
      toast.success("Register successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Register failed");
    } finally {
      set({ isSigningUp: false });
    }
  },
  login: async (data: LoginType) => {
    set({ isLoggingIn: true });
    try {
      const response = await API.post("/auth/login", data);
      set({ user: response.data.user });
      useSocket.getState().connectSocket();
      toast.success("Login successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Register failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },
  logout: async () => {
    try {
      await API.post("/auth/logout");
      set({ user: null });
      useSocket.getState().disconnectSocket();
      toast.success("Logout successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Register failed");
    }
  },
  isAuthStatus: async () => {
    set({ isAuthStatusLoading: true });
    try {
      const response = await API.get("/auth/status");
      set({ user: response.data.user });
      useSocket.getState().connectSocket();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Authentication failed");
      console.log(err);
      //set({ user: null})
    } finally {
      set({ isAuthStatusLoading: false });
    }
  },
 
  // ─── NEW: Update profile (name, bio, avatar) ────────────────────────────────
  updateProfile: async (data: UpdateProfileType) => {
    set({ isUpdatingProfile: true });
    try {
      const response = await API.patch("/user/me", data);
      set({ user: response.data.user });
      toast.success("Profile updated successfully");
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update profile");
      return false;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },
}));
 