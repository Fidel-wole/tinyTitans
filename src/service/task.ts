import { Task } from "../model/task";
import { ITask, TaskType } from "../interface/task";
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

      // Get the task details to check its type
      const taskDetails = await Task.findById(data.task_id);
      if (!taskDetails) {
        throw new Error("Task not found.");
      }

      // If task is a quiz, automatically set status to completed
      if (taskDetails.type === TaskType.QUIZ && data.metadata?.quiz) {
        data.status = TaskStatus.COMPLETED;
      }

      const isCompleted = data.status === TaskStatus.COMPLETED;
      
      let taskIndex = user.tasks_progress.findIndex(
        (t) => t.task_id.toString() === data.task_id.toString()
      );

      if (taskIndex === -1) {
        // If the task doesn't exist yet, create a new entry
        user.tasks_progress.push({
          task_id: data.task_id,
          status: data.status || TaskStatus.ONGOING,
          started_at: new Date(),
          last_updated_at: new Date(),
          progress: data.progress || 0,
          metadata: data.metadata || {},
        });
        
        // If this is a new task being marked as completed, reward the user
        if (isCompleted) {
          user.coins += taskDetails.reward_points;
        }
      } else {
        // Update existing task
        const task = user.tasks_progress[taskIndex];
        const previousStatus = task.status;
        
        // Update status if provided or if it's a quiz task
        if (data.status) {
          task.status = data.status;
        }
        
        // Update progress if provided
        if (data.progress !== undefined) {
          task.progress = data.progress;
        }
        
        // Update metadata if provided, preserving existing fields
        if (data.metadata) {
          // Merge metadata instead of replacing it
          task.metadata = {
            ...task.metadata, // Keep existing metadata
            ...data.metadata, // Add/update with new metadata
            
            // Special handling for nested objects
            ...(data.metadata.quiz && task.metadata?.quiz ? {
              quiz: { ...task.metadata.quiz, ...data.metadata.quiz }
            } : {}),
            
            ...(data.metadata.referral && task.metadata?.referral ? {
              referral: { ...task.metadata.referral, ...data.metadata.referral }
            } : {})
          };
        }
        
        task.last_updated_at = new Date();
        
        // If task is being marked as completed for the first time, reward the user
        if (isCompleted && previousStatus !== TaskStatus.COMPLETED) {
          user.coins += taskDetails.reward_points;
        }
      }

      await user.save();
      return user;
    } catch (err: any) {
      throw new Error(`Error tracking task progress: ${err.message}`);
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
