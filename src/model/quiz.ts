import mongoose, { Schema, model } from 'mongoose';
import { IQuiz, IQuizQuestion } from '../interface/quiz';

// Quiz Question Schema
const QuizQuestionSchema: Schema<IQuizQuestion> = new Schema({
  quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
  question: { type: String, required: true },
  options: [
    {
      text: { type: String, required: true },
      isCorrect: { type: Boolean, required: true },
    },
  ],
  order: { type: Number, required: true },
  timeLimit: { type: Number, default: 30 },
});

// Quiz Schema
const QuizSchema: Schema<IQuiz> = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    questions: [{ type: Schema.Types.ObjectId, ref: 'QuizQuestion' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isPublished: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Export Models
export const Quiz = model<IQuiz>('Quiz', QuizSchema);
export const QuizQuestion = model<IQuizQuestion>('QuizQuestion', QuizQuestionSchema);
