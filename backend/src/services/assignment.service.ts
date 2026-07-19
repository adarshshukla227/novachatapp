import mongoose from "mongoose";
import AssignmentModel from "../models/assignment.model";
import { NotFoundException, UnauthorizedException } from "../utils/app-error";

export const createAssignmentService = async (
  chatId: string,
  userId: string,
  body: { title: string; subject: string; deadline: string }
) => {
  const assignment = new AssignmentModel({
    chatId,
    title: body.title,
    subject: body.subject,
    deadline: new Date(body.deadline),
    createdBy: userId,
    completedBy: [],
  });
  await assignment.save();
  return assignment.populate("createdBy", "name avatar");
};

export const getAssignmentsService = async (chatId: string) => {
  return AssignmentModel.find({ chatId })
    .populate("createdBy", "name avatar")
    .populate("completedBy", "name avatar")
    .sort({ deadline: 1 });
};

export const toggleAssignmentCompleteService = async (
  assignmentId: string,
  userId: string
) => {
  const assignment = await AssignmentModel.findById(assignmentId);
  if (!assignment) throw new NotFoundException("Assignment not found");

  const alreadyDone = assignment.completedBy.some(
    (id) => id.toString() === userId
  );

  if (alreadyDone) {
    assignment.completedBy = assignment.completedBy.filter(
      (id) => id.toString() !== userId
    );
  } else {
    assignment.completedBy.push(new mongoose.Types.ObjectId(userId));
  }

  await assignment.save();
  const updated = await AssignmentModel.findById(assignmentId)
    .populate("createdBy", "name avatar")
    .populate("completedBy", "name avatar");
  return updated;
};

export const deleteAssignmentService = async (
  assignmentId: string,
  userId: string
) => {
  const assignment = await AssignmentModel.findById(assignmentId);
  if (!assignment) throw new NotFoundException("Assignment not found");
  if (assignment.createdBy.toString() !== userId)
    throw new UnauthorizedException("Only creator can delete this assignment");
  await assignment.deleteOne();
  return { deleted: true };
};