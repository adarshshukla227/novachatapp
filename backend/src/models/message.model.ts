import mongoose, { Document, Schema } from "mongoose";
 
export interface ReactionType {
  user: mongoose.Types.ObjectId;
  emoji: string;
}
 
export interface MessageDocument extends Document {
  chatId: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content?: string;
  image?: string;
  replyTo?: mongoose.Types.ObjectId;
  reactions: ReactionType[];
  status: "sent" | "delivered" | "seen";
  // ─── Call fields ───────────────────────────────────────────────────────────
  messageType: "text" | "call";
  callType?: "voice" | "video";
  callStatus?: "missed" | "connected" | "declined" | "offline";
  callDuration?: number; // seconds mein
  // ──────────────────────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}
 
const reactionSchema = new Schema<ReactionType>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: { type: String, required: true },
  },
  { _id: false }
);
 
const messageSchema = new Schema<MessageDocument>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    content: { type: String },
    image: { type: String },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    // WhatsApp-style ticks
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    // ─── Call fields ─────────────────────────────────────────────────────────
    messageType: {
      type: String,
      enum: ["text", "call"],
      default: "text",
    },
    callType: {
      type: String,
      enum: ["voice", "video"],
      default: null,
    },
    callStatus: {
      type: String,
      // missed   → ring timeout ya koi na utha
      // connected → call connected aur properly end hui
      // declined  → receiver ne cut kiya
      // offline   → jisko call ki wo online nahi tha
      enum: ["missed", "connected", "declined", "offline"],
      default: null,
    },
    callDuration: {
      type: Number, // seconds
      default: 0,
    },
    // ─────────────────────────────────────────────────────────────────────────
  },
  {
    timestamps: true,
  }
);
 
const MessageModel = mongoose.model<MessageDocument>("Message", messageSchema);
 
export default MessageModel;