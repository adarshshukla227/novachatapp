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
  status: "sent" | "delivered" | "seen"; // NEW
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
    // NEW — message status for WhatsApp-style ticks
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
  },
  {
    timestamps: true,
  }
);
 
const MessageModel = mongoose.model<MessageDocument>("Message", messageSchema);
 
export default MessageModel;