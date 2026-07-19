import { Router } from "express";
import authRoutes from "./auth.route";
import chatRoutes from "./chat.route";
import userRoutes from "./user.route";
import assignmentRoutes from "./assignment.route"; // ✅ add this

const router = Router();
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/user", userRoutes);
router.use("/assignment", assignmentRoutes); // ✅ add this

export default router;