import User from "../model/user";
import { IUser } from "../interface/user";
import { generateReferralCode } from "../utils/strings";
import { Battle } from "../model/battle";
import mongoose from "mongoose";

export default class UserService {
  static async createUser(user: IUser) {
    try {
      let existingUser = await this.getUser(user.telegram_user_id);

      if (!existingUser) {
        if (user.referral_code) {
          console.log(user.referral_code);
          const referrer = await User.findOne({
            referral_code: user.referral_code,
          });

          if (referrer) {
            user.referred_by = referrer._id as string;
            await User.updateOne(
              { _id: user.referred_by },
              { $inc: { referral_earnings: 2000, coins: 2000 } }
            );
          } else {
            throw new Error("Invalid referral code");
          }
        }
        user.referral_code = generateReferralCode();
        existingUser = await User.create(user);
      }

      return existingUser;
    } catch (err) {
      throw new Error(err as any);
    }
  }

  static async getUser(telegram_user_id: string) {
    try {
      const user = await User.findOne({ telegram_user_id });
      return user;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  static async getReferrals(telegram_user_id: string) {
    try {
      const user = await User.findOne({ telegram_user_id }).populate(
        "referred_by"
      );
      if (!user) {
        throw new Error("User not found");
      }
      const referrals = await User.find({ referred_by: user._id });
      return referrals;
    } catch (err: any) {
      throw new Error(err);
    }
  }
  static async getLeaderboard() {
    try {
      const users = await User.find().sort({ coins: -1 }).limit(10);

      return users;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new Error(err.message);
      }
      throw new Error(
        "An unknown error occurred while fetching the leaderboard"
      );
    }
  }

  static async selectCharacter(telegram_user_id: string, characterId: string) {
    try {
      const user = await User.findOne({ telegram_user_id });

      if (!user) {
        throw new Error("User not found");
      }

      await user.select_character(characterId);

      return user;
    } catch (err: any) {
      throw new Error(err.message);
    }
  }

  /**
   * Updates a user's information and game state
   * @param userId - The telegram user ID
   * @param updateData - The data to update
   */
  static async updateUser(
    user_id: string,
    updateData: Partial<IUser>
  ): Promise<IUser> {
    try {
      const user = await User.findOne({ telegram_user_id: user_id });
      if (!user) {
        throw new Error("User not found");
      }

      // Prevent updating sensitive fields
      const protectedFields = [
        "user_id",
        "referral_code",
        "referred_by",
        "created_at",
        "updated_at",
      ];

      protectedFields.forEach((field) => {
        delete updateData[field as keyof typeof updateData];
      });

      // Handle energy logic
      if (updateData.energy !== undefined) {
        updateData.energy = Math.min(updateData.energy, user.max_energy);
        updateData.last_energy_update = new Date();
      }

      if (updateData.tap_power !== undefined) {
        updateData.tap_power *= user.tap_multiplier;
      }

      // ⚡ Update stats of the currently selected avatar
      if (
        updateData.avatars &&
        updateData.avatars.length > 0 &&
        user.avatar // currently selected avatar ID
      ) {
        const currentAvatar = user.avatars.find(
          (a) => a.character.toString() === user.avatar?.toString()
        );

        const incomingAvatarUpdate = updateData.avatars.find(
          (a) => a.character.toString() === user.avatar?.toString()
        );

        if (
          currentAvatar &&
          incomingAvatarUpdate?.stats?.experience !== undefined
        ) {
          const incomingExp = incomingAvatarUpdate.stats.experience || 0;
          const totalExp = currentAvatar.stats.experience + incomingExp;

          if (totalExp >= currentAvatar.stats.experience_needed) {
            user.level += 1;
            user.skill_points += 1;
            currentAvatar.stats.experience =
              totalExp - currentAvatar.stats.experience_needed;
            currentAvatar.stats.experience_needed *= 1.5;
          } else {
            currentAvatar.stats.experience = totalExp;
          }
        }
      }

      // Set all other updateable fields
      Object.assign(user, updateData);

      await user.save();

      return user;
    } catch (error: any) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  /**
   * Get user profile statistics including battles fought, wins, coins earned, tasks completed and referrals
   * @param telegram_user_id The user's telegram ID
   * @returns User profile statistics or null if user not found
   */
  static async getUserProfile(telegram_user_id: string) {
    try {
      // Get basic user info
      const user = await User.findOne({ telegram_user_id });
      if (!user) {
        return null;
      }

      // Get battle statistics
      const battles = await Battle.find({ user_id: user._id });
      const totalBattles = battles.length;
      const battlesWon = battles.filter(battle => battle.result === 'victory').length;
      
      // Calculate coins earned from battles
      const battleCoinsEarned = battles.reduce((sum, battle) => sum + (battle.coins_earned || 0), 0);
      
      // Count completed tasks
      const completedTasks = user.tasks_progress.filter(task => task.status === 'completed').length;
      
      // Get total referrals (users who have this user as their referrer)
      const referrals = await User.countDocuments({ referred_by: user._id });

      return {
        userId: user._id,
        username: user.username,
        level: user.level,
        totalBattles,
        battlesWon,
        winRate: totalBattles > 0 ? Math.round((battlesWon / totalBattles) * 100) : 0,
        totalCoinsEarned: battleCoinsEarned,
        currentCoins: user.coins,
        tasksCompleted: completedTasks,
        totalReferrals: referrals,
        energy: user.energy,
        maxEnergy: user.max_energy,
        // Include avatar info if exists
        avatarStats: user.avatar ? {
          avatarId: user.avatar,
          // Find the selected avatar's stats
          ...user.avatars.find(a => a.character.toString() === user.avatar?.toString())?.stats
        } : null
      };
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw new Error(`Failed to fetch user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
