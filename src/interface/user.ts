export interface IUser {
  // Basic Information
  telegram_userId: string;
  username: string;
  profile_picture?: string;
  
  // Game Mechanics
  energy: number;
  maxEnergy: number;
  energyRegenRate: number;
  lastEnergyUpdate: Date;
  tapPower: number;
  tapMultiplier: number;
  cooldown: number;
  lastTapTime: Date;
  
  // Currency & Resources
  coins: number;
  gems: number;
  level: number;
  
  // Character System
  avatar?: string; // Reference to Character model
  avatar_stats: {
    power: number;
    defense: number;
    speed: number;
    health: number;
    experience: number;
    experienceNeeded: number;
  };
  
  // Progression System
  skillPoints: number;
  upgrades: {
    tapPower: number;
    energyCapacity: number;
    energyRegen: number;
    cooldownReduction: number;
  };
  
  // Missions & Achievements
  achievements: string[];
  completedMissions: string[];
  dailyMissions: {
    missionId: string;
    progress: number;
    completed: boolean;
  }[];
  
  // Web3 Integration
  walletAddress?: string;
  tokenBalance: number;
  nftId?: string;
  isNFT: boolean;
  transactionHistory: {
    type: string;
    amount: number;
    timestamp: Date;
    txHash: string;
  }[];
  
  // Social Features
  referral_code: string;
  referred_by?: string;
  referral_earnings: number;
  teamId?: string;
  lastDailyReward: Date;
}
