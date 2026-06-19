import mongoose, { Document, Schema } from "mongoose";

export interface ChatDocument extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage: mongoose.Types.ObjectId;
  isGroup: boolean;
  groupName: string;
  groupAdmin: mongoose.Types.ObjectId | null;
  groupAvatar: string | null;
  groupDescription: string | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<ChatDocument>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
    },
    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    groupAvatar: {
      type: String,
      default: null,
    },
    groupDescription: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ChatModel = mongoose.model<ChatDocument>("Chat", chatSchema);
export default ChatModel;