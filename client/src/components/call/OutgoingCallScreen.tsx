import { PhoneOff } from "lucide-react";
import { useCall } from "@/hooks/use-call";
import AvatarWithBadge from "../avatar-with-badge";

interface Props {
  calleeName?: string;
  calleeAvatar?: string;
}

const OutgoingCallScreen = ({ calleeName, calleeAvatar }: Props) => {
  const { callData, endCall } = useCall();

  if (!callData) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center gap-6 px-4">
      <AvatarWithBadge name={calleeName || "Calling..."} src={calleeAvatar} />
      <h3 className="text-xl font-semibold text-white">{calleeName}</h3>
      <p className="text-sm text-gray-300 animate-pulse">
        {callData.type === "video" ? "Video calling..." : "Calling..."}
      </p>

      <button
        onClick={endCall}
        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition mt-4"
      >
        <PhoneOff size={22} />
      </button>
    </div>
  );
};

export default OutgoingCallScreen;