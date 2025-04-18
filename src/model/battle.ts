import mongoose, { Schema } from "mongoose";
import { BattleResult, BattleStatus, IBattle } from "../interface/battle";

const BattleActionSchema = new Schema({
  type: { 
    type: String, 
    enum: ['attack', 'defend', 'special'],
    required: true 
  },
  damage_dealt: { type: Number },
  damage_blocked: { type: Number },
  critical_hit: { type: Boolean, default: false }
});

const BattleParticipantStatsSchema = new Schema({
  initial_health: { type: Number, required: true },
  current_health: { type: Number, required: true },
  power: { type: Number, required: true },
  defense: { type: Number, required: true },
  speed: { type: Number, required: true }
});

const BattleRoundSchema = new Schema({
  round_number: { type: Number, required: true },
  user_action: { type: BattleActionSchema, required: true },
  opponent_action: { type: BattleActionSchema, required: true },
  result: { type: String, required: true }
});

const BattleSchema = new Schema<IBattle>({
  user_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  opponent_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  opponent_npc: {
    name: { type: String },
    level: { type: Number },
    power: { type: Number },
    defense: { type: Number },
    health: { type: Number },
    image: { type: String }
  },
  status: { 
    type: String, 
    enum: Object.values(BattleStatus),
    default: BattleStatus.IN_PROGRESS,
    required: true 
  },
  result: { 
    type: String, 
    enum: Object.values(BattleResult)
  },
  energy_spent: { 
    type: Number, 
    required: true,
    min: 1 
  },
  coins_earned: { 
    type: Number, 
    default: 0
  },
  experience_earned: { 
    type: Number, 
    default: 0
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  completed_at: { 
    type: Date 
  },
  battle_data: {
    rounds: [BattleRoundSchema],
    user_stats: { type: BattleParticipantStatsSchema, required: true },
    opponent_stats: { type: BattleParticipantStatsSchema, required: true }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
BattleSchema.index({ user_id: 1 });
BattleSchema.index({ status: 1 });
BattleSchema.index({ created_at: 1 });

export const Battle = mongoose.model<IBattle>("Battle", BattleSchema);

// NPC Opponents for PvE battles
export const BattleOpponents = [
  {
    name: "Goblin",
    level: 1,
    power: 8,
    defense: 3,
    health: 50,
    image: "/images/opponents/goblin.png",
    rewards: {
      min_coins: 10,
      max_coins: 20,
      experience: 15
    }
  },
  {
    name: "Orc Warrior",
    level: 3,
    power: 12,
    defense: 6,
    health: 80,
    image: "/images/opponents/orc.png",
    rewards: {
      min_coins: 20,
      max_coins: 35,
      experience: 25
    }
  },
  {
    name: "Cave Troll",
    level: 5,
    power: 18,
    defense: 10,
    health: 120,
    image: "/images/opponents/troll.png",
    rewards: {
      min_coins: 30,
      max_coins: 60,
      experience: 40
    }
  },
  {
    name: "Forest Dragon",
    level: 8,
    power: 25,
    defense: 15,
    health: 180,
    image: "/images/opponents/dragon.png",
    rewards: {
      min_coins: 50,
      max_coins: 100,
      experience: 65
    }
  },
  {
    name: "Ancient Guardian",
    level: 10,
    power: 35,
    defense: 22,
    health: 250,
    image: "/images/opponents/guardian.png",
    rewards: {
      min_coins: 80,
      max_coins: 160,
      experience: 100
    }
  }
];