import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useCall } from "@/hooks/use-call";
import AvatarWithBadge from "../avatar-with-badge";

interface ParticipantMeta {
  userId: string;
  name: string;
  avatar?: string;
}

interface Props {
  participantsMeta: ParticipantMeta[]; // names/avatars resolved by caller (from chat.participants)
}

function useElapsedSeconds(startedAt: number | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return seconds;
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const RemoteVideoTile = ({
  stream,
  name,
  avatar,
  videoEnabled,
}: {
  stream?: MediaStream;
  name: string;
  avatar?: string;
  videoEnabled: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center">
      {stream && videoEnabled ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <AvatarWithBadge name={name} src={avatar} />
      )}
      <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">
        {name}
      </span>
    </div>
  );
};

const ActiveCallScreen = ({ participantsMeta }: Props) => {
  const {
    callData,
    localStream,
    participants,
    isMuted,
    isCameraOff,
    callStartedAt,
    toggleMute,
    toggleCamera,
    endCall,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const elapsed = useElapsedSeconds(callStartedAt);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!callData) return null;

  const isVideo = callData.type === "video";
  const remoteUserIds = Object.keys(participants);

  const getMeta = (userId: string) =>
    participantsMeta.find((p) => p.userId === userId) || { userId, name: "User" };

  // ─── Voice call UI ───────────────────────────────────────────────────────
  if (!isVideo) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-wrap items-center justify-center gap-6">
          {remoteUserIds.length === 0 ? (
            <p className="text-gray-300 text-sm">Connecting...</p>
          ) : (
            remoteUserIds.map((uid) => {
              const meta = getMeta(uid);
              const p = participants[uid];
              return (
                <div key={uid} className="flex flex-col items-center gap-2">
                  <AvatarWithBadge name={meta.name} src={meta.avatar} />
                  <span className="text-white text-sm">{meta.name}</span>
                  {!p.audioEnabled && (
                    <MicOff size={14} className="text-red-400" />
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="text-gray-300 text-sm">{formatDuration(elapsed)}</p>

        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isVideo={false}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onEndCall={endCall}
        />
      </div>
    );
  }

  // ─── Video call UI ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex-1 relative p-2">
        <div
          className={`grid gap-2 w-full h-full ${
            remoteUserIds.length <= 1
              ? "grid-cols-1"
              : remoteUserIds.length <= 3
              ? "grid-cols-2"
              : "grid-cols-2 grid-rows-2"
          }`}
        >
          {remoteUserIds.length === 0 ? (
            <div className="flex items-center justify-center text-gray-400 text-sm">
              Connecting...
            </div>
          ) : (
            remoteUserIds.map((uid) => {
              const meta = getMeta(uid);
              const p = participants[uid];
              return (
                <RemoteVideoTile
                  key={uid}
                  stream={p.stream}
                  name={meta.name}
                  avatar={meta.avatar}
                  videoEnabled={p.videoEnabled}
                />
              );
            })
          )}
        </div>

        {/* Local preview (small, bottom-right) */}
        <div className="absolute bottom-4 right-4 w-28 h-40 rounded-xl overflow-hidden bg-zinc-800 shadow-lg border border-white/10">
          {!isCameraOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
              Camera off
            </div>
          )}
        </div>

        <span className="absolute top-4 left-4 text-xs text-white bg-black/50 px-2 py-1 rounded-full">
          {formatDuration(elapsed)}
        </span>
      </div>

      <div className="pb-6 pt-3 flex justify-center bg-black">
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isVideo={true}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onEndCall={endCall}
        />
      </div>
    </div>
  );
};

const CallControls = ({
  isMuted,
  isCameraOff,
  isVideo,
  onToggleMute,
  onToggleCamera,
  onEndCall,
}: {
  isMuted: boolean;
  isCameraOff: boolean;
  isVideo: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
}) => (
  <div className="flex items-center gap-5">
    <button
      onClick={onToggleMute}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
        isMuted ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
    </button>

    {isVideo && (
      <button
        onClick={onToggleCamera}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
          isCameraOff ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"
        }`}
      >
        {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
      </button>
    )}

    <button
      onClick={onEndCall}
      className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition"
    >
      <PhoneOff size={22} />
    </button>
  </div>
);

export default ActiveCallScreen;