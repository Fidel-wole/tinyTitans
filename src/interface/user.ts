export interface IUser {
  // Basic Information
  telegram_user_id: string;
  username: string;
  profile_picture?: string;

  // Game Mechanics
  energy: number;
  max_energy: number;
  energy_regen_rate: number;
  last_energy_update: Date;
  tap_power: number;
  tap_multiplier: number;
  cooldown: number;
  last_tap_time: Date;

  // Currency & Resources
  coins: number;
  gems: number;
  level: number;

  // Character System
  avatar?: string;
  avatars: {
    character: string;
    stats: {
      power: number;
      defense: number;
      speed: number;
      health: number;
      experience: number;
      experience_needed: number;
    };
  }[];

  // Progression System
  skill_points: number;
  upgrades: {
    tap_power: number;
    energy_capacity: number;
    energy_regen: number;
    cooldown_reduction: number;
  };

  // Missions & Achievements
  achievements: string[];
  completed_missions: string[];
  daily_missions: {
    mission_id: string;
    progress: number;
    completed: boolean;
  }[];

  // Web3 Integration
  wallet_address?: string;
  token_balance: number;
  nft_id?: string;
  is_nft: boolean;
  transaction_history: {
    type: string;
    amount: number;
    timestamp: Date;
    tx_hash: string;
  }[];

  // Social Features
  referral_code: string;
  referred_by?: string;
  referral_earnings: number;
  team_id?: string;
  last_daily_reward: Date;
}
