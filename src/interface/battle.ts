import { Document, Types } from 'mongoose';

export enum BattleStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELED = 'canceled'
}

export enum BattleResult {
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  DRAW = 'draw',
  ABANDONED = 'abandoned'
}

export interface IBattle extends Document {
  _id: string | Types.ObjectId;
  user_id: Types.ObjectId;
  opponent_id?: Types.ObjectId; // Added for PvP battles
  status: BattleStatus;
  result?: BattleResult;
  energy_spent: number;
  coins_earned: number;
  experience_earned: number;
  created_at: Date;
  completed_at?: Date;
  // Track which player attacked first (for PvP battles)
  first_attacker?: 'user' | 'opponent';
  opponent_npc?: {
    name: string;
    level: number;
    power: number;
    defense: number;
    health: number;
    image?: string;
  };
  battle_data: {
    rounds: {
      round_number: number;
      user_action: BattleAction;
      opponent_action: BattleAction;
      result: string;
      // Add timestamp to track when the action was performed
      timestamp?: number;
    }[];
    user_stats: {
      initial_health: number;
      current_health: number;
      power: number;
      defense: number;
      speed: number;
    };
    opponent_stats: {
      initial_health: number;
      current_health: number;
      power: number;
      defense: number;
      speed: number;
    };
  };
}

export interface BattleRound {
  round_number: number;
  user_action: BattleAction;
  opponent_action: BattleAction;
  result: string;
}

export interface BattleAction {
  type: 'attack' | 'defend' | 'special';
  damage_dealt?: number;
  damage_blocked?: number;
  critical_hit?: boolean;
}

export interface BattleParticipantStats {
  initial_health: number;
  current_health: number;
  power: number;
  defense: number;
  speed: number;
}

export interface BattleRewards {
  coins: number;
  experience: number;
  items?: any[];
}

export interface BattleRequest {
  telegram_user_id: string;
  battle_type: 'pve' | 'pvp';
  opponent_id?: string; // For PvP battles
  difficulty?: 'easy' | 'medium' | 'hard'; // For PvE battles
  energy_to_spend: number;
}

export interface IBattleOpponent {
  name: string;
  level: number;
  power: number;
  defense: number;
  health: number;
  image?: string;
  rewards: {
    min_coins: number;
    max_coins: number;
    experience: number;
  };
}