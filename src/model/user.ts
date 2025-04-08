import { Schema, model, Document } from "mongoose";
import { IUser } from "../interface/user";

interface IUserModel extends IUser, Document {}

const UserSchema = new Schema<IUserModel>(
  {
    telegram_userId: { type: String, unique: true, required: true },
    username: { type: String, required: true },
    profile_picture: { type: String },
    coins: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    avatar: {
      type: Schema.Types.ObjectId,
      ref: "Character"
    },
    referral_code: { type: String, unique: true },
    referred_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    referral_earnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const User = model<IUserModel>("User", UserSchema);
export default User;
