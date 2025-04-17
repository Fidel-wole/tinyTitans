import QuizService from "../service/quiz";
import { Request, Response } from "express";
import { IQuiz, IQuizQuestion } from "../interface/quiz";
import Dispatcher from "../utils/dispatcher";

export default class QuizController {
  // Create a new quiz
  static async createQuiz(req: Request, res: Response): Promise<void> {
    try {
      const quizData: IQuiz & {
        questionList: Omit<IQuizQuestion, "quizId">[];
      } = req.body;
      const quiz = await QuizService.createQuiz(quizData);
      Dispatcher.DispatchSuccessMessage(res, "Quiz created successfully", quiz);
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
  // Get all quizzes
  static async getAllQuizzes(req: Request, res: Response): Promise<void> {
    try {
      const quizzes = await QuizService.getAllQuizzes();
      Dispatcher.DispatchSuccessMessage(
        res,
        "Quizzes fetched successfully",
        quizzes
      );
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
  // Get a quiz by ID
  static async getQuizById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quiz = await QuizService.getQuizById(id);
      if (!quiz) {
        Dispatcher.DispatchNotFoundMessage(res);
        return;
      }
      Dispatcher.DispatchSuccessMessage(res, "Quiz fetched successfully", quiz);
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
  // Update a quiz by ID
  static async updateQuiz(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quizData: Partial<IQuiz> = req.body;
      const quiz = await QuizService.updateQuiz(id, quizData);
      if (!quiz) {
        Dispatcher.DispatchNotFoundMessage(res);
        return;
      }
      Dispatcher.DispatchSuccessMessage(res, "Quiz updated successfully", quiz);
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
  // Delete a quiz by ID
  static async deleteQuiz(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quiz = await QuizService.deleteQuiz(id);
      if (!quiz) {
        Dispatcher.DispatchNotFoundMessage(res);
        return;
      }
      Dispatcher.DispatchSuccessMessage(res, "Quiz deleted successfully");
      return;
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error);
      return;
    }
  }
}
