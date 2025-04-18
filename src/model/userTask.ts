import mongoose, { Schema, Document, model } from "mongoose";

export interface IUserTaskProgressModel extends Document {
  user_id: Schema.Types.ObjectId;
  task_id: Schema.Types.ObjectId;
  progress: number;
  target: number;
  completed: boolean;
  completed_at?: Date;
}

const UserTaskProgressSchema = new Schema<IUserTaskProgressModel>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    task_id: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    target: {
      type: Number,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completed_at: {
      type: Date,
    },
  },
  { timestamps: true }
);

UserTaskProgressSchema.index({ user_id: 1, task_id: 1 }, { unique: true });

const UserTaskProgress = model<IUserTaskProgressModel>(
  "UserTaskProgress",
  UserTaskProgressSchema
);

export default UserTaskProgress;
