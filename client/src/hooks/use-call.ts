import { create } from "zustand";
import { useAuth } from "./use-auth";
import { useSocket } from "./use-socket";
import { generateUUID } from "@/lib/helper";
import type { CallType, CallUIState, ActiveCallData, CallParticipantInfo } from "@/types/call.type";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface PeerEntry {
  pc: RTCPeerConnection;
  makingOffer: boolean;
}

interface CallState {
  uiState: CallUIState;
  callData: ActiveCallData | null;

  localStream: MediaStream | null;
  participants: Record<string, CallParticipantInfo>;

  isMuted: boolean;
  isCameraOff: boolean;
  callStartedAt: number | null;

  incomingCallInfo: (ActiveCallData & { from?: string }) | null;

  _peers: Record<string, PeerEntry>;
  _pendingCandidates: Record<string, RTCIceCandidateInit[]>;

  startCall: (chatId: string, type: CallType, isGroup: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  _initSocketListeners: () => void;
  _cleanup: () => void;
}

let listenersInitialized = false;

export const useCall = create<CallState>()((set, get) => ({
  uiState: "idle",
  callData: null,
  localStream: null,
  participants: {},
  isMuted: false,
  isCameraOff: false,
  callStartedAt: null,
  incomingCallInfo: null,
  _peers: {},
  _pendingCandidates: {},

  startCall: async (chatId, type, isGroup) => {
    const { socket } = useSocket.getState();
    if (!socket) {
      console.error("[use-call] Cannot start call — socket not connected");
      return;
    }

    const callId = generateUUID();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      set({
        localStream: stream,
        uiState: "outgoing",
        callData: { callId, chatId, type, isGroup, initiatorId: useAuth.getState().user?._id || "" },
        isMuted: false,
        isCameraOff: false,
      });

      socket.emit(
        "call:initiate",
        { callId, chatId, type },
        (err?: string) => {
          if (err) {
            console.error("Call initiate failed:", err);
            get()._cleanup();
          }
        }
      );
    } catch (error) {
      console.error("Failed to get media devices:", error);
      get()._cleanup();
    }
  },

  acceptCall: async () => {
    const { socket } = useSocket.getState();
    const incoming = get().incomingCallInfo;
    if (!socket || !incoming) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incoming.type === "video",
      });

      set({
        localStream: stream,
        uiState: "ongoing",
        callData: incoming,
        incomingCallInfo: null,
        callStartedAt: Date.now(),
        isMuted: false,
        isCameraOff: false,
      });

      socket.emit("call:join", { callId: incoming.callId });
    } catch (error) {
      console.error("Failed to get media devices:", error);
      socket.emit("call:decline", { callId: incoming.callId });
      set({ incomingCallInfo: null, uiState: "idle" });
    }
  },

  declineCall: () => {
    const { socket } = useSocket.getState();
    const incoming = get().incomingCallInfo;
    if (!socket || !incoming) return;

    socket.emit("call:decline", { callId: incoming.callId });
    set({ incomingCallInfo: null, uiState: "idle" });
  },

  endCall: () => {
    const { socket } = useSocket.getState();
    const { callData } = get();
    if (socket && callData) {
      socket.emit("call:leave", { callId: callData.callId });
    }
    get()._cleanup();
  },

  toggleMute: () => {
    const { localStream, isMuted, callData } = get();
    if (!localStream) return;
    const newMuted = !isMuted;
    localStream.getAudioTracks().forEach((track) => (track.enabled = !newMuted));
    set({ isMuted: newMuted });

    const { socket } = useSocket.getState();
    if (socket && callData) {
      socket.emit("call:media-state", {
        callId: callData.callId,
        audioEnabled: !newMuted,
        videoEnabled: !get().isCameraOff,
      });
    }
  },

  toggleCamera: () => {
    const { localStream, isCameraOff, callData } = get();
    if (!localStream) return;
    const newCameraOff = !isCameraOff;
    localStream.getVideoTracks().forEach((track) => (track.enabled = !newCameraOff));
    set({ isCameraOff: newCameraOff });

    const { socket } = useSocket.getState();
    if (socket && callData) {
      socket.emit("call:media-state", {
        callId: callData.callId,
        audioEnabled: !get().isMuted,
        videoEnabled: !newCameraOff,
      });
    }
  },

  _initSocketListeners: () => {
    const { socket } = useSocket.getState();
    if (!socket) {
      console.log("[use-call] socket not ready yet, will retry on next mount/render");
      return;
    }

    if (listenersInitialized) return;
    listenersInitialized = true;

    console.log("[use-call] registering call socket listeners on socket id:", socket.id);

    const createPeerConnection = (remoteUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const { localStream } = get();
      localStream?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const { callData } = get();
          if (callData) {
            socket.emit("call:ice-candidate", {
              callId: callData.callId,
              to: remoteUserId,
              candidate: event.candidate,
            });
          }
        }
      };

      pc.ontrack = (event) => {
        set((state) => ({
          participants: {
            ...state.participants,
            [remoteUserId]: {
              ...(state.participants[remoteUserId] || {
                userId: remoteUserId,
                audioEnabled: true,
                videoEnabled: true,
              }),
              stream: event.streams[0],
            },
          },
        }));
      };

      pc.onconnectionstatechange = () => {
        set((state) => ({
          participants: {
            ...state.participants,
            [remoteUserId]: {
              ...(state.participants[remoteUserId] || {
                userId: remoteUserId,
                audioEnabled: true,
                videoEnabled: true,
              }),
              connectionState: pc.connectionState,
            },
          },
        }));

        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          removePeer(remoteUserId);
        }
      };

      set((state) => ({
        _peers: { ...state._peers, [remoteUserId]: { pc, makingOffer: false } },
      }));

      return pc;
    };

    const getOrCreatePeer = (remoteUserId: string): RTCPeerConnection => {
      const existing = get()._peers[remoteUserId];
      if (existing) return existing.pc;
      return createPeerConnection(remoteUserId);
    };

    const removePeer = (remoteUserId: string) => {
      const peer = get()._peers[remoteUserId];
      if (peer) {
        peer.pc.close();
        set((state) => {
          const peers = { ...state._peers };
          delete peers[remoteUserId];
          const participants = { ...state.participants };
          delete participants[remoteUserId];
          return { _peers: peers, participants };
        });
      }
    };

    const makeOfferTo = async (remoteUserId: string) => {
      const { callData } = get();
      if (!callData) return;
      const pc = getOrCreatePeer(remoteUserId);
      const peerEntry = get()._peers[remoteUserId];
      if (peerEntry) peerEntry.makingOffer = true;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", {
          callId: callData.callId,
          to: remoteUserId,
          sdp: pc.localDescription,
        });
      } finally {
        if (peerEntry) peerEntry.makingOffer = false;
      }
    };

    socket.on("call:incoming", (data) => {
      console.log("[use-call] received call:incoming", data);
      if (get().uiState !== "idle") {
        socket.emit("call:decline", { callId: data.callId });
        return;
      }
      set({ uiState: "incoming", incomingCallInfo: data });
    });

    socket.on("call:joined-participants", async ({ participants }: { participants: string[] }) => {
      console.log("[use-call] call:joined-participants", participants);
      for (const remoteUserId of participants) {
        await makeOfferTo(remoteUserId);
      }
    });

    socket.on("call:participant-joined", () => {
      // no-op; new joiner initiates offers
    });

    socket.on("call:offer", async ({ from, sdp }) => {
      console.log("[use-call] received call:offer from", from);
      const pc = getOrCreatePeer(from);
      await pc.setRemoteDescription(sdp);

      const pending = get()._pendingCandidates[from];
      if (pending?.length) {
        for (const c of pending) {
          await pc.addIceCandidate(c).catch(() => {});
        }
        set((state) => {
          const p = { ...state._pendingCandidates };
          delete p[from];
          return { _pendingCandidates: p };
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const { callData } = get();
      if (callData) {
        socket.emit("call:answer", {
          callId: callData.callId,
          to: from,
          sdp: pc.localDescription,
        });
      }
    });

    socket.on("call:answer", async ({ from, sdp }) => {
      console.log("[use-call] received call:answer from", from);
      const peer = get()._peers[from];
      if (!peer) return;
      await peer.pc.setRemoteDescription(sdp);

      const pending = get()._pendingCandidates[from];
      if (pending?.length) {
        for (const c of pending) {
          await peer.pc.addIceCandidate(c).catch(() => {});
        }
        set((state) => {
          const p = { ...state._pendingCandidates };
          delete p[from];
          return { _pendingCandidates: p };
        });
      }
    });

    socket.on("call:ice-candidate", async ({ from, candidate }) => {
      const peer = get()._peers[from];
      if (peer?.pc.remoteDescription) {
        await peer.pc.addIceCandidate(candidate).catch(() => {});
      } else {
        set((state) => ({
          _pendingCandidates: {
            ...state._pendingCandidates,
            [from]: [...(state._pendingCandidates[from] || []), candidate],
          },
        }));
      }
    });

    socket.on("call:media-state", ({ from, audioEnabled, videoEnabled }) => {
      set((state) => ({
        participants: {
          ...state.participants,
          [from]: {
            ...(state.participants[from] || { userId: from }),
            audioEnabled,
            videoEnabled,
          },
        },
      }));
    });

    socket.on("call:accepted", () => {
      console.log("[use-call] received call:accepted");
      set({ uiState: "ongoing", callStartedAt: Date.now() });
    });

    socket.on("call:declined", () => {
      console.log("[use-call] received call:declined");
      get()._cleanup();
    });

    socket.on("call:participant-declined", ({ userId }) => {
      removePeer(userId);
    });

    socket.on("call:participant-left", ({ userId }) => {
      removePeer(userId);
    });

    socket.on("call:cancelled", () => {
      get()._cleanup();
    });

    socket.on("call:ended", () => {
      console.log("[use-call] received call:ended");
      get()._cleanup();
    });

    socket.on("call:missed-summary", () => {
      if (get().uiState === "outgoing" || get().uiState === "incoming") {
        get()._cleanup();
      }
    });
  },

  _cleanup: () => {
    const { localStream, _peers } = get();
    localStream?.getTracks().forEach((track) => track.stop());
    Object.values(_peers).forEach((p) => p.pc.close());

    set({
      uiState: "idle",
      callData: null,
      localStream: null,
      participants: {},
      isMuted: false,
      isCameraOff: false,
      callStartedAt: null,
      incomingCallInfo: null,
      _peers: {},
      _pendingCandidates: {},
    });
  },
}));