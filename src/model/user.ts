import mongoose, { Schema, Document, model } from "mongoose";
import { ICharacter } from "../interface/avatar";
import { IUser } from "../interface/user";

export interface IUserModel extends IUser, Document {
  selectCharacter(characterId: string): Promise<void>;
  upgradeAvatarStats(newStats: { power?: number; defense?: number; speed?: number }): Promise<void>;
  calculateCurrentEnergy(): number;
}

const UserSchema = new Schema<IUserModel>(
  {
    // Basic Information
    telegram_userId: { type: String, unique: true, required: true },
    username: { type: String, required: true },
    profile_picture: { type: String },
    
    // Game Mechanics
    energy: { type: Number, default: 100 },
    maxEnergy: { type: Number, default: 100 },
    energyRegenRate: { type: Number, default: 1 },
    lastEnergyUpdate: { type: Date, default: Date.now },
    tapPower: { type: Number, default: 1 },
    tapMultiplier: { type: Number, default: 1 },
    cooldown: { type: Number, default: 1 },
    lastTapTime: { type: Date, default: Date.now },
    
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
        experienceNeeded: { type: Number, default: 100 },
      },
      default: {
        power: 0,
        defense: 0,
        speed: 0,
        health: 100,
        experience: 0,
        experienceNeeded: 100,
      },
    },
    
    // Progression System
    skillPoints: { type: Number, default: 0 },
    upgrades: {
      tapPower: { type: Number, default: 0 },
      energyCapacity: { type: Number, default: 0 },
      energyRegen: { type: Number, default: 0 },
      cooldownReduction: { type: Number, default: 0 }
    },
    
    // Missions & Achievements
    achievements: [{ type: String }],
    completedMissions: [{ type: String }],
    dailyMissions: [{
      missionId: String,
      progress: { type: Number, default: 0 },
      completed: { type: Boolean, default: false }
    }],
    
    // Web3 Integration
    walletAddress: { type: String },
    tokenBalance: { type: Number, default: 0 },
    nftId: { type: String },
    isNFT: { type: Boolean, default: false },
    transactionHistory: [{
      type: String,
      amount: Number,
      timestamp: { type: Date, default: Date.now },
      txHash: String
    }],
    
    // Social Features
    referral_code: { type: String, unique: true },
    referred_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    referral_earnings: { type: Number, default: 0 },
    teamId: { type: String },
    lastDailyReward: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Indexes for better query performance
UserSchema.index({ telegram_userId: 1 });
UserSchema.index({ referral_code: 1 });
UserSchema.index({ teamId: 1 });
UserSchema.index({ walletAddress: 1 });

// Method to select a character
UserSchema.methods.selectCharacter = async function (characterId: string) {
  try {
    const Character = model<ICharacter>("Character");
    const character = await Character.findById(characterId);

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
      experienceNeeded: 100
    };

    await this.save();
  } catch (err: any) {
    throw new Error(err.message);
  }
};

// Method to upgrade avatar stats
UserSchema.methods.upgradeAvatarStats = async function (newStats: { power?: number; defense?: number; speed?: number }) {
  this.avatar_stats.power += newStats.power || 0;
  this.avatar_stats.defense += newStats.defense || 0;
  this.avatar_stats.speed += newStats.speed || 0;
  this.avatar_stats.experience += 10; // Example experience gain on upgrade
  this.avatar_stats.experienceNeeded += 20; // Increase experience needed for next level
  this.skillPoints -= 1; // Deduct skill point for upgrade
  return this.save();
};

// Method to calculate current energy based on regeneration
UserSchema.methods.calculateCurrentEnergy = function() {
  const now = new Date();
  const timeDiff = (now.getTime() - this.lastEnergyUpdate.getTime()) / 1000; // in seconds
  const regeneratedEnergy = Math.floor(timeDiff * this.energyRegenRate);
  return Math.min(this.maxEnergy, this.energy + regeneratedEnergy);
};

const User = model<IUserModel>("User", UserSchema);
export default User;
