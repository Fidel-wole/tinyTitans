import { Quiz, QuizQuestion } from "../model/quiz";
import { IQuiz, IQuizQuestion } from "../interface/quiz";
import { Types } from "mongoose";

export default class QuizService {
  // Create a new quiz and its questions
  static async createQuiz(quizData: IQuiz & { questionList: Omit<IQuizQuestion, "quizId">[] }) {
    // 1. Extract questionList and other quiz fields
    const { questionList, ...quizFields } = quizData;

    // 2. Create the quiz first (without questions yet)
    const quiz = new Quiz(quizFields);
    await quiz.save();

    // 3. Create quiz questions linked to this quiz
    const questionDocs = await Promise.all(
      questionList.map(async (question, index) => {
        const questionDoc = new QuizQuestion({
          ...question,
          quizId: quiz._id,
          order: question.order ?? index + 1,
        });
        return await questionDoc.save();
      })
    );

    // 4. Attach question IDs to the quiz and save
    quiz.questions = questionDocs.map((q) => q._id as Types.ObjectId);
    await quiz.save();

    return quiz.populate("questions");
  }

  // Get all quizzes
  static async getAllQuizzes() {
    return await Quiz.find().populate("questions");
  }

  // Get a quiz by ID
  static async getQuizById(id: string) {
    return await Quiz.findById(id).populate("questions");
  }

  // Update a quiz by ID
  static async updateQuiz(id: string, quizData: Partial<IQuiz>) {
    return await Quiz.findByIdAndUpdate(id, quizData, { new: true }).populate("questions");
  }

  // Delete a quiz by ID
  static async deleteQuiz(id: string) {
    return await Quiz.findByIdAndDelete(id);
  }
}
