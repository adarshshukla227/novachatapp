import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "../config/http.config";
import {
  createAssignmentService,
  getAssignmentsService,
  toggleAssignmentCompleteService,
  deleteAssignmentService,
} from "../services/assignment.service";

export const createAssignmentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { chatId } = req.params;
    const { title, subject, deadline } = req.body;
    const assignment = await createAssignmentService(chatId, userId, {
      title,
      subject,
      deadline,
    });
    return res.status(HTTPSTATUS.CREATED).json({
      message: "Assignment created successfully",
      assignment,
    });
  }
);

export const getAssignmentsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const assignments = await getAssignmentsService(chatId);
    return res.status(HTTPSTATUS.OK).json({
      message: "Assignments fetched successfully",
      assignments,
    });
  }
);

export const toggleAssignmentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { assignmentId } = req.params;
    const assignment = await toggleAssignmentCompleteService(
      assignmentId,
      userId
    );
    return res.status(HTTPSTATUS.OK).json({
      message: "Assignment updated successfully",
      assignment,
    });
  }
);

export const deleteAssignmentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { assignmentId } = req.params;
    const result = await deleteAssignmentService(assignmentId, userId);
    return res.status(HTTPSTATUS.OK).json({
      message: "Assignment deleted successfully",
      ...result,
    });
  }
);