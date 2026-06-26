import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useCall } from "@/hooks/use-call";
import AvatarWithBadge from "../avatar-with-badge";

interface ParticipantMeta {
  userId: string;
  name: string;
  avatar?: string;
}

interface Props {
  participantsMeta: ParticipantMeta[];
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

const RemoteAudioOnly = ({ stream }: { stream?: MediaStream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay />;
};

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
  const audioRef = useRef<HTMLAudioElement>(null);

  // ✅ FIX: added `videoEnabled` to the dependency array.
  // The <video> element is conditionally rendered below (mounted/unmounted
  // based on `stream && videoEnabled`), so when the remote user turns their
  // camera back on, a BRAND NEW <video> element is mounted. Without
  // `videoEnabled` here, this effect only re-ran when `stream` itself
  // changed — which it doesn't on a simple toggle — so the new <video>
  // element's srcObject was never assigned, leaving it black.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, videoEnabled]);

  return (
    <div className="relative w-full h-full bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center">
      <audio ref={audioRef} autoPlay />

      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
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

  // ✅ FIX: added `isCameraOff` to the dependency array.
  // The local preview <video> below is also conditionally rendered
  // ({!isCameraOff ? <video/> : <div>Camera off</div>}), so toggling the
  // camera back on mounts a NEW <video> element. Without `isCameraOff`
  // here, this effect only re-ran when `localStream` changed — which it
  // doesn't on a simple toggle (it's the same MediaStream object the whole
  // call) — so the new element's srcObject was never set, leaving it black.
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

  if (!callData) return null;

  const isVideo = callData.type === "video";
  const remoteUserIds = Object.keys(participants);

  const getMeta = (userId: string) =>
    participantsMeta.find((p) => p.userId === userId) || { userId, name: "User" };

  // ─── Voice call UI ───────────────────────────────────────────────────────
  if (!isVideo) {
    return createPortal(
      <div
        className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center gap-6 px-4"
        style={{ zIndex: 99999 }}
      >
        {remoteUserIds.map((uid) => (
          <RemoteAudioOnly key={uid} stream={participants[uid].stream} />
        ))}

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
      </div>,
      document.body
    );
  }

  // ─── Video call UI ───────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 99999 }}>
      {/* FIX: min-h-0 + overflow-hidden — prevents remote video's intrinsic
          size from forcing this flex item taller than the viewport, which
          was pushing the controls bar (and local preview) off-screen */}
      <div className="flex-1 relative p-2 min-h-0 overflow-hidden">
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

      {/* FIX: shrink-0 — stops this bar from being compressed/squeezed by
          the flex layout. relative z-10 isolate — creates its own stacking
          context so the <video> element's hardware layer can never render
          on top of it. */}
      <div className="pb-6 pt-3 flex justify-center bg-black shrink-0 relative z-10 isolate">
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isVideo={true}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onEndCall={endCall}
        />
      </div>
    </div>,
    document.body
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
