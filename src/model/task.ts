import mongoose, { Schema, Document } from "mongoose";
import { ITask, TaskType } from "../interface/task";

const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: TaskType,
      required: true,
    },
    reward_points: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Task = mongoose.model<ITask>("Task", TaskSchema);
