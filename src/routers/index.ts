import { Router } from "express";
import userRouter from "./user";

const testRouter = Router();

testRouter.get("/", (req, res) => {
  res.send("Welcome to Tiny Titans Backend Service");
});
const v1Router: Router[] = [testRouter, userRouter];
export default v1Router;
