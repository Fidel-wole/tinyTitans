import { Document, Types } from 'mongoose';

// Interface for a single option in a quiz question
export interface IQuizOption {
  text: string;
  isCorrect: boolean;
}

// Interface for individual quiz questions
export interface IQuizQuestion extends Document {
  quizId: Types.ObjectId;
  question: string;
  options: IQuizOption[];
  order: number;
  timeLimit?: number;
}

// Interface for the full quiz
export interface IQuiz extends Document {
  title: string;
  description?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questions: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
