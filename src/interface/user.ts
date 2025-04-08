export interface IUser {
    telegram_userId: string;
    username: string;
    profile_picture: string;
    level: number;
    avatar?: string;
    energy: { type: Number, default: 100 },
    coins: number;
    gems: number;
    referral_code?: string;
    referred_by?: string;
    referral_earnings: number;
    createdAt?: Date;
    updatedAt?: Date;
  }
  