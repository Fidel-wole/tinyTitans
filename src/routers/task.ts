import TaskController from "../controller/task";
import { Router } from "express";

const taskRouter = Router();

// Create a new task
taskRouter.post("/task/create", TaskController.createTask);
taskRouter.get("/tasks", TaskController.getAllTasks);
taskRouter.get("/task/:type", TaskController.getTaskById);
taskRouter.put(
  "/task/track-progress",
    TaskController.trackTaskProgress
);
taskRouter.get("/task/stats/:user_id", TaskController.getUserTaskStats);
taskRouter.put("/task/complete", TaskController.completeTask);
    
export default taskRouter;