import TaskService from "../service/task";
import { Request, Response } from "express";
import Dispatcher from "../utils/dispatcher";
import { ITask } from "../interface/task";

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
    }