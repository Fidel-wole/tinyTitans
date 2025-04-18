import { Router } from "express";
import userRouter from "./user";
import multer from "multer";
import { uploadImage } from "../controller/cloudinary";
import characterRouter from "./character";
import quizRouter from "./quiz";
import taskRouter from "./task";
import battleRouter from "./battle";

const testRouter = Router();

const uploadRouter = Router();

const upload = multer({ dest: "uploads/" });

uploadRouter.post("/upload", upload.single("image"), uploadImage);

testRouter.get("/", (req, res) => {
  res.send("Welcome to Tiny Titans Backend Service");
});
const v1Router: Router[] = [
  testRouter,
  uploadRouter,
  userRouter,
  characterRouter,
  quizRouter,
  taskRouter,
  battleRouter,
];
export default v1Router;
