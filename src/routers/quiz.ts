import { Router } from "express";
import QuizController from "../controller/quiz";

const quizRouter = Router();

// Create a new quiz
quizRouter.post("/quiz/create", QuizController.createQuiz);
quizRouter.get("/quizes", QuizController.getAllQuizzes);
quizRouter.get("/quiz/:id", QuizController.getQuizById);
quizRouter.put("/quiz/:id", QuizController.updateQuiz);
quizRouter.delete("/quiz/:id", QuizController.deleteQuiz);

// Export the router
export default quizRouter;