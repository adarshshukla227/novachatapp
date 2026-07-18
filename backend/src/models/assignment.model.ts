import mongoose, { Document, Schema } from "mongoose";

export interface AssignmentDocument extends Document {
  chatId: mongoose.Types.ObjectId;
  title: string;
  subject: string;
  deadline: Date;
  createdBy: mongoose.Types.ObjectId;
  completedBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<AssignmentDocument>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    completedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
  },
  { timestamps: true }
);

const AssignmentModel = mongoose.model<AssignmentDocument>(
  "Assignment",
  assignmentSchema
);
export default AssignmentModel;