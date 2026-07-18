import { Router } from "express";
import {
  createAssignmentController,
  getAssignmentsController,
  toggleAssignmentController,
  deleteAssignmentController,
} from "../controllers/assignment.controller";
import { passportAuthenticateJwt } from "../config/passport.config";

const router = Router();

router
  .use(passportAuthenticateJwt)
  .post("/:chatId", createAssignmentController)
  .get("/:chatId", getAssignmentsController)
  .patch("/:assignmentId/toggle", toggleAssignmentController)
  .delete("/:assignmentId", deleteAssignmentController);

export default router;