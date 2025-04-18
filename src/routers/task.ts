import TaskController from "../controller/task";
import { Router } from "express";

const taskRouter = Router();

// Create a new task
taskRouter.post("/task/create", TaskController.createTask);
taskRouter.get("/tasks", TaskController.getAllTasks);

export default taskRouter;