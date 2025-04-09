import mongoose, { Schema, Document, model } from "mongoose";
import { ICharacter } from "../interface/avatar";
import { IUser } from "../interface/user";

export interface IUserModel extends IUser, Document {
  selectCharacter(characterId: string): Promise<void>;
}

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
      ref: "Character",
      default: null,
    },
    avatar_stats: {
      type: {
        power: { type: Number, default: 0 },
        defense: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
      },
      default: {
        power: 0,
        defense: 0,
        speed: 0,
      },
    },
    referral_code: { type: String, unique: true },
    referred_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    referral_earnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);


UserSchema.methods.selectCharacter = async function (characterId: string) {
  try {
    const Character = model<ICharacter>("Character"); // Ensure you import the Character model
    const character = await Character.findById(characterId);

    if (!character) {
      throw new Error("Character not found");
    }

    this.avatar = character._id;
    this.avatar_stats = {
      power: character.power, // Assume the Character model has these fields
      defense: character.defense,
      speed: character.speed,
    };

    await this.save(); // Save the updated user document
  } catch (err: any) {
    throw new Error(err.message);
  }
};

// Method to upgrade avatar stats
UserSchema.methods.upgradeAvatarStats = function (newStats: { power?: number; defense?: number; speed?: number }) {
  // Update the avatar stats by adding the new upgrades
  this.avatar_stats.power += newStats.power || 0;
  this.avatar_stats.defense += newStats.defense || 0;
  this.avatar_stats.speed += newStats.speed || 0;

  // Save the updated user document
  return this.save();
};

const User = model<IUserModel>("User", UserSchema);
export default User;
