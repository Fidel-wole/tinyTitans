import TaskService from "../service/task";
import { Request, Response } from "express";
import Dispatcher from "../utils/dispatcher";
import { ITask } from "../interface/task";
import { ITaskOngoing } from "../interface/user";

export default class TaskController {
  // Create a new task
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      const taskData: ITask = req.body;
      const task = await TaskService.createTask(taskData);
      Dispatcher.DispatchSuccessMessage(res, "Task created successfully", task);
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }

  // Get all tasks
  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const tasks = await TaskService.getTasks();
      Dispatcher.DispatchSuccessMessage(
        res,
        "Tasks fetched successfully",
        tasks
      );
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
  // Get task by ID
  static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type;
      const task = await TaskService.getTaskByType(type);
      if (!task) {
        Dispatcher.DispatchErrorMessage(res, "Task not found");
        return;
      }
      Dispatcher.DispatchSuccessMessage(res, "Task fetched successfully", task);
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }

  // Track task progress
  static async trackTaskProgress(req: Request, res: Response): Promise<void> {
    try {
      const data: ITaskOngoing = req.body;
      const userId = req.body.telegram_user_id;
      const taskProgress = await TaskService.trackTaskProgress(data, userId);

      Dispatcher.DispatchSuccessMessage(
        res,
        "Task progress tracked successfully",
        taskProgress
      );
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }

  static async completeTask(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.body.telegram_user_id;
      const taskId = req.body.task_id;
      const completedTask = await TaskService.completeTask(userId, taskId);

      Dispatcher.DispatchSuccessMessage(
        res,
        "Task completed successfully",
        completedTask
      );
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
      return;
    }
  }

  static async getUserTaskStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.user_id;
      const taskStats = await TaskService.getUserTaskStats(userId);
      Dispatcher.DispatchSuccessMessage(
        res,
        "User task stats fetched successfully",
        taskStats
      );
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
}
