import { Router } from "express";
import UserController from "../controller/user";

const userRouter = Router();

userRouter.post("/user/register", UserController.createUser);

export default userRouter;