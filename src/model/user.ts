import mongoose, { Schema, Document, model } from "mongoose";
import { ICharacter } from "../interface/avatar";
import { IUser } from "../interface/user";

export interface IUserModel extends IUser, Document {
  select_character(character_id: string): Promise<void>;
  upgrade_avatar_stats(new_stats: { power?: number; defense?: number; speed?: number }): Promise<void>;
  calculate_current_energy(): number;
}

const UserSchema = new Schema<IUserModel>(
  {
    // Basic Information
    telegram_user_id: { type: String, unique: true, required: true },
    username: { type: String, required: true },
    profile_picture: { type: String },
    
    // Game Mechanics
    energy: { type: Number, default: 100 },
    max_energy: { type: Number, default: 100 },
    energy_regen_rate: { type: Number, default: 1 },
    last_energy_update: { type: Date, default: Date.now },
    tap_power: { type: Number, default: 1 },
    tap_multiplier: { type: Number, default: 1 },
    cooldown: { type: Number, default: 1 },
    last_tap_time: { type: Date, default: Date.now },
    
    // Currency & Resources
    coins: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    
    // Character System
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
        health: { type: Number, default: 100 },
        experience: { type: Number, default: 0 },
        experience_needed: { type: Number, default: 100 },
      },
      default: {
        power: 0,
        defense: 0,
        speed: 0,
        health: 100,
        experience: 0,
        experience_needed: 100,
      },
    },
    
    // Progression System
    skill_points: { type: Number, default: 0 },
    upgrades: {
      tap_power: { type: Number, default: 0 },
      energy_capacity: { type: Number, default: 0 },
      energy_regen: { type: Number, default: 0 },
      cooldown_reduction: { type: Number, default: 0 }
    },
    
    // Missions & Achievements
    achievements: [{ type: String }],
    completed_missions: [{ type: String }],
    daily_missions: [{
      mission_id: String,
      progress: { type: Number, default: 0 },
      completed: { type: Boolean, default: false }
    }],
    
    // Web3 Integration
    wallet_address: { type: String },
    token_balance: { type: Number, default: 0 },
    nft_id: { type: String },
    is_nft: { type: Boolean, default: false },
    transaction_history: [{
      type: String,
      amount: Number,
      timestamp: { type: Date, default: Date.now },
      tx_hash: String
    }],
    
    // Social Features
    referral_code: { type: String, unique: true },
    referred_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    referral_earnings: { type: Number, default: 0 },
    team_id: { type: String },
    last_daily_reward: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Indexes for better query performance
UserSchema.index({ telegram_user_id: 1 });
UserSchema.index({ referral_code: 1 });
UserSchema.index({ team_id: 1 });
UserSchema.index({ wallet_address: 1 });

// Method to select a character
UserSchema.methods.select_character = async function (character_id: string) {
  try {
    const Character = model<ICharacter>("Character");
    const character = await Character.findById(character_id);

    if (!character) {
      throw new Error("Character not found");
    }

    this.avatar = character._id;
    this.avatar_stats = {
      power: character.power,
      defense: character.defense,
      speed: character.speed,
      health: character.health,
      experience: 0,
      experience_needed: 100
    };

    await this.save();
  } catch (err: any) {
    throw new Error(err.message);
  }
};

// Method to upgrade avatar stats
UserSchema.methods.upgrade_avatar_stats = async function (new_stats: { power?: number; defense?: number; speed?: number }) {
  this.avatar_stats.power += new_stats.power || 0;
  this.avatar_stats.defense += new_stats.defense || 0;
  this.avatar_stats.speed += new_stats.speed || 0;
  this.avatar_stats.experience += 10; // Example experience gain on upgrade
  this.avatar_stats.experience_needed += 20; // Increase experience needed for next level
  this.skill_points -= 1; // Deduct skill point for upgrade
  return this.save();
};

// Method to calculate current energy based on regeneration
UserSchema.methods.calculate_current_energy = function() {
  const now = new Date();
  const time_diff = (now.getTime() - this.last_energy_update.getTime()) / 1000; // in seconds
  const regenerated_energy = Math.floor(time_diff * this.energy_regen_rate);
  return Math.min(this.max_energy, this.energy + regenerated_energy);
};

const User = model<IUserModel>("User", UserSchema);
export default User;
