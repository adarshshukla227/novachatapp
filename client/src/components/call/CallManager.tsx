import { useEffect } from "react";
import { useCall } from "@/hooks/use-call";
import { useChat } from "@/hooks/use-chat";
import { useSocket } from "@/hooks/use-socket";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallScreen from "./OutgoingCallScreen";
import ActiveCallScreen from "./ActiveCallScreen";

const CallManager = () => {
  const { uiState, callData, incomingCallInfo, _initSocketListeners } = useCall();
  const { chats } = useChat();
  const { socket } = useSocket(); // subscribe so this re-renders once socket connects

  useEffect(() => {
    if (socket) {
      _initSocketListeners();
    }
  }, [socket, _initSocketListeners]);

  const relevantChatId = callData?.chatId || incomingCallInfo?.chatId;
  const chat = chats.find((c) => c._id === relevantChatId);

  const participantsMeta = (chat?.participants || []).map((p: any) => ({
    userId: p._id,
    name: p.name,
    avatar: p.avatar,
  }));

  if (uiState === "incoming" && incomingCallInfo) {
    const caller = participantsMeta.find((p) => p.userId === incomingCallInfo.initiatorId);
    return <IncomingCallModal callerName={caller?.name} callerAvatar={caller?.avatar} />;
  }

  if (uiState === "outgoing") {
    const others = participantsMeta.filter((p) => p.userId !== callData?.initiatorId);
    const callee = others[0];
    return <OutgoingCallScreen calleeName={callee?.name} calleeAvatar={callee?.avatar} />;
  }

  if (uiState === "ongoing") {
    return <ActiveCallScreen participantsMeta={participantsMeta} />;
  }

  return null;
};

export default CallManager;