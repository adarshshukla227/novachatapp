import { Router } from "express";
import {
  createAssignmentController,
  getAssignmentsController,
  toggleAssignmentController,
  deleteAssignmentController,
} from "../controllers/assignment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.post("/:chatId", createAssignmentController);
router.get("/:chatId", getAssignmentsController);
router.patch("/:assignmentId/toggle", toggleAssignmentController);
router.delete("/:assignmentId", deleteAssignmentController);

export default router;