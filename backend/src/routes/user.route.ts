import { Router } from "express";
import { passportAuthenticateJwt } from "../config/passport.config";
import {
  getUsersController,
  getMyProfileController,
  updateProfileController,
} from "../controllers/user.controller";
 
const userRoutes = Router()
  .use(passportAuthenticateJwt)
  .get("/all", getUsersController)
  .get("/me", getMyProfileController)        // NEW — get own profile
  .patch("/me", updateProfileController);    // NEW — update own profile
 
export default userRoutes;
 