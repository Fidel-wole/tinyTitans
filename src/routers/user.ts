import { Router } from "express";
import UserController from "../controller/user";

const userRouter = Router();

userRouter.post("/user/register", UserController.createUser);
userRouter.get("/user/:telegram_userId", UserController.getUser);
userRouter.get(
  "/user/:telegram_userId/referrals",
  UserController.getReferrals
);
userRouter.get("/leaderboard", UserController.getLeaderboard);
export default userRouter;