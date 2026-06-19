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
  participants: Record<string, CallParticipantInfo>; // userId -> info (remote peers)

  isMuted: boolean;
  isCameraOff: boolean;
  callStartedAt: number | null;

  incomingCallInfo: (ActiveCallData & { from?: string }) | null;

  // internal (not for UI)
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

  // ─── Start a call (caller side) ─────────────────────────────────────────
  startCall: async (chatId, type, isGroup) => {
    const { socket } = useSocket.getState();
    if (!socket) return;

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

  // ─── Accept an incoming call (callee side) ──────────────────────────────
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

  // ─── Internal: create/get a peer connection for a remote user ──────────
  _initSocketListeners: () => {
    if (listenersInitialized) return;
    listenersInitialized = true;

    const { socket } = useSocket.getState();
    if (!socket) return;

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

    // Incoming call ring
    socket.on("call:incoming", (data) => {
      // If already in a call, auto-decline (busy) — simple v1 behavior
      if (get().uiState !== "idle") {
        socket.emit("call:decline", { callId: data.callId });
        return;
      }
      set({ uiState: "incoming", incomingCallInfo: data });
    });

    // I joined — server tells me who is already in
    socket.on("call:joined-participants", async ({ participants }: { participants: string[] }) => {
      for (const remoteUserId of participants) {
        await makeOfferTo(remoteUserId);
      }
    });

    // Someone else joined after me — I wait for their offer (they will offer to me too,
    // since server's call:joined-participants only fires for the NEW joiner;
    // for symmetry, the new joiner offers to everyone already in, including me)
    socket.on("call:participant-joined", () => {
      // No action needed here; the new participant initiates offers to existing ones.
    });

    socket.on("call:offer", async ({ from, sdp }) => {
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
      // For 1-to-1 caller side, once accepted, move to ongoing (join flow also fires call:joined-participants)
      set({ uiState: "ongoing", callStartedAt: Date.now() });
    });

    socket.on("call:declined", () => {
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
      get()._cleanup();
    });

    socket.on("call:missed-summary", () => {
      // Chat list / message list will reflect this via a separate chat message
      // (sent from backend as a normal message), so just ensure call UI resets
      // for anyone who was still "ringing".
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