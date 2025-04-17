export interface ICharacter {
    // Basic Information
    name: string;
    image: string;
    type: {
        type: string;
        enum: ["Fighter", "Ninja", "Demon", "Warrior"];
    };
    
    // Combat Attributes
    level: number;
    power: number;
    defense: number;
    speed: number;
    health: number;
    
    // Visual/Type Attributes
    race: string;
    rarity: {
        type: string;
        enum: ["Common", "Rare", "Epic", "Legendary"];
    };
    abilities: string[];
    appearance: {
        skinColor?: string;
        hairColor?: string;
        eyeColor?: string;
        accessories?: string[];
    };

    // Progression System
    experience: number;
    experienceNeeded: number;

    // Gameplay Mechanics
    energy: number;
    maxEnergy: number;
    energyRegenRate: number;
    lastEnergyUpdate: Date;
    tapPower: number;
    tapMultiplier: number;
    cooldown: number;
    lastTapTime: Date;

    // Progression System
    skillPoints: number;
    upgrades: {
        tapPower: number;
        energyCapacity: number;
        energyRegen: number;
        cooldownReduction: number;
    };
    achievements: string[];
    completedMissions: string[];
    dailyMissions: {
        missionId: string;
        progress: number;
        completed: boolean;
    }[];

    // Web3 Integration
    walletAddress: string;
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
    referralCode: string;
    referredBy?: string;
    teamId?: string;
    lastDailyReward: Date;
}