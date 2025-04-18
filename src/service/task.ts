import { Task } from "../model/task";
import { ITask } from "../interface/task";
import User from "../model/user";
import mongoose from "mongoose";
import { TaskStatus } from "../interface/user";
import { ITaskOngoing } from "../interface/user";

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

  static async getTaskByType(type: string) {
    try {
      const task = await Task.find({ type: type });
      return task;
    } catch (err: any) {
      throw new Error(err);
    }
  }
  static async trackTaskProgress(data: ITaskOngoing, userId: string) {
    try {
      const user = await User.findOne({ telegram_user_id: userId });

      if (!user) {
        throw new Error("User not found.");
      }

      let task = user.tasks_progress.find((t) => t.task_id === data.task_id);

      if (!task) {
        // If the task is not ongoing, create a new entry for the task
        user.tasks_progress.push({
          task_id: data.task_id,
          status: TaskStatus.ONGOING,
          started_at: new Date(),
          last_updated_at: new Date(),
          progress: data.progress || 0,
          metadata: data.metadata,
        });
      } else {
        // If the task is ongoing, update the progress
        task.progress = data.progress;
        task.last_updated_at = new Date();
        task.metadata = data.metadata; // Update metadata (e.g., quiz progress)
      }

      await user.save();
      return user;
    } catch (err: any) {
      throw new Error(`Error tracking task progress: ${err.message}`);
    }
  }

  // Complete the task and reward the user
  static async completeTask(userId: string, taskId: string) {
    try {
      const user = await User.findOne({ telegram_user_id: userId });

      if (!user) {
        throw new Error("User not found.");
      }
console.log(user)
      // Find the ongoing task in the user's tasks
      const ongoingTaskIndex = user.tasks_progress.findIndex(
        (t) =>
          t.task_id.toString() === taskId && t.status === TaskStatus.ONGOING
      );

      if (ongoingTaskIndex === -1) {
        throw new Error("Task not in progress.");
      }

      // Mark the task as completed
      const task = user.tasks_progress[ongoingTaskIndex];
      task.status = TaskStatus.COMPLETED;
      task.last_updated_at = new Date();

      // Reward the user with the task's reward points (assuming Task contains reward_points)
      const taskData = await Task.findById(taskId);
      if (!taskData) {
        throw new Error("Task not found.");
      }

      user.coins += taskData.reward_points; // Add coins for completing the task

      user.tasks_progress[ongoingTaskIndex].status = TaskStatus.COMPLETED;

      await user.save();

      return user;
    } catch (err: any) {
      throw new Error(`Error completing task: ${err.message}`);
    }
  }

  static async getTotalCompletedTasks(userId: string) {
    try {
      const user = await User.findOne({ telegram_user_id: userId });

      if (!user) {
        throw new Error("User not found.");
      }

      // Filter out tasks that are completed
      const completedTasks = user.tasks_progress.filter(
        (task) => task.status === TaskStatus.COMPLETED
      );

      return completedTasks.length;
    } catch (err: any) {
      throw new Error(`Error fetching total completed tasks: ${err.message}`);
    }
  }

  static async getTotalCoinsEarned(userId: string) {
    try {
      const user = await User.findOne({ telegram_user_id: userId });

      if (!user) {
        throw new Error("User not found.");
      }

      // Calculate total coins from completed tasks
      const completedTasks = user.tasks_progress.filter(
        (task) => task.status === TaskStatus.COMPLETED
      );

      let totalCoins = 0;
      for (const task of completedTasks) {
        const taskData = await Task.findById(task.task_id);
        if (taskData) {
          totalCoins += taskData.reward_points;
        }
      }

      return totalCoins;
    } catch (err: any) {
      throw new Error(`Error fetching total coins earned: ${err.message}`);
    }
  }

  static async getTotalQuizzesCompleted(userId: string) {
    try {
      const user = await User.findOne({ telegram_user_id: userId });

      if (!user) {
        throw new Error("User not found.");
      }

      // Count how many tasks have metadata (e.g., quizzes)
      const completedQuizzes = user.tasks_progress.filter(
        (task) =>
          task.status === TaskStatus.COMPLETED &&
          task.metadata &&
          task.metadata.quiz
      );

      return completedQuizzes.length;
    } catch (err: any) {
      throw new Error(`Error fetching total quizzes completed: ${err.message}`);
    }
  }
  static async getUserTaskStats(userId: string) {
    try {
      const user = await User.findOne({ telegram_user_id: userId });

      if (!user) {
        throw new Error("User not found.");
      }

      const totalCompletedTasks = await this.getTotalCompletedTasks(userId);
      const totalCoinsEarned = await this.getTotalCoinsEarned(userId);
      const totalQuizzesCompleted = await this.getTotalQuizzesCompleted(userId);

      return {
        totalCompletedTasks,
        totalCoinsEarned,
        totalQuizzesCompleted,
      };
    } catch (err: any) {
      throw new Error(`Error fetching user stats: ${err.message}`);
    }
  }
}
