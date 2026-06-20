import { createPortal } from "react-dom";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useCall } from "@/hooks/use-call";
import AvatarWithBadge from "../avatar-with-badge";

interface Props {
  callerName?: string;
  callerAvatar?: string;
}

const IncomingCallModal = ({ callerName, callerAvatar }: Props) => {
  const { incomingCallInfo, acceptCall, declineCall } = useCall();

  if (!incomingCallInfo) return null;

  const isVideo = incomingCallInfo.type === "video";

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center px-4"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
        <span className="text-sm text-muted-foreground">
          Incoming {isVideo ? "video" : "voice"} call
        </span>

        <AvatarWithBadge name={callerName || "Unknown"} src={callerAvatar} />

        <h3 className="text-lg font-semibold">{callerName || "Unknown"}</h3>
        <p className="text-sm text-muted-foreground animate-pulse">Ringing...</p>

        <div className="flex items-center gap-8 mt-4">
          <button
            onClick={declineCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition"
          >
            <PhoneOff size={22} />
          </button>

          <button
            onClick={acceptCall}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition"
          >
            {isVideo ? <Video size={22} /> : <Phone size={22} />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IncomingCallModal;