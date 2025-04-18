import { Task } from "../model/task";
import { ITask } from "../interface/task";

export default class TaskService {
    static async createTask(task: ITask) {
        try {
        const newTask = await Task.create(task);
        return newTask;
        } catch (err: any) {
        throw new Error(err);
        }
    }
    
    static async getTasks() {
        try {
        const tasks = await Task.find();
        return tasks;
        } catch (err: any) {
        throw new Error(err);
        }
    }
    
    static async getTaskById(id: string) {
        try {
        const task = await Task.findById(id);
        return task;
        } catch (err: any) {
        throw new Error(err);
        }
    }
    }