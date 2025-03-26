import { Schema, model, Document } from "mongoose";
import { IUser } from "../interface/user";

interface IUserModel extends IUser, Document {}

const UserSchema = new Schema<IUserModel>(
  {
    telegram_userId: { type: String, unique: true, required: true },
    username: { type: String, required: true },
    profilePicture: { type: String, required: true },
  },
  { timestamps: true }
);

const User = model<IUserModel>("User", UserSchema);
export default User;
