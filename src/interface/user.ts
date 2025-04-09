export interface IUser {
  telegram_userId: string;
  username: string;
  profile_picture: string;
  level: number;
  avatar?: string; // This will store the character's ObjectId or character reference
  avatar_stats: {
    power: number;
    defense: number;
    speed: number;
  }; // Added the avatar stats for upgraded character stats
  energy: number; // Energy will be stored as a number with a default of 100
  coins: number;
  gems: number;
  referral_code?: string;
  referred_by?: string; // The ID of the user who referred this user
  referral_earnings: number;
  createdAt?: Date;
  updatedAt?: Date;
}
