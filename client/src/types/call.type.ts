export type CallType = "voice" | "video";
export type CallUIState =
  | "idle"
  | "outgoing"   // main calling kar raha hoon, ringing
  | "incoming"   // mujhe call aa rahi hai
  | "ongoing";   // connected

export interface CallParticipantInfo {
  userId: string;
  name?: string;
  avatar?: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionState?: RTCPeerConnectionState;
}

export interface ActiveCallData {
  callId: string;
  chatId: string;
  type: CallType;
  isGroup: boolean;
  initiatorId: string;
}