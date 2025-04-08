import User from "../model/user";
import { IUser } from "../interface/user";
import { generateReferralCode } from "../utils/strings";

export default class UserService {
  static async createUser(user: IUser) {
    try {
      let existingUser = await this.getUser(user.telegram_userId);

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
              { $inc: { referral_earnings: 2000 } }
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

  static async getUser(telegram_userId: string) {
    try {
      const user = await User.findOne({ telegram_userId });
      return user;
    } catch (err: any) {
      throw new Error(err);
    }
  }

  static async getReferrals(telegram_userId: string) {
    try {
      const user = await User.findOne({ telegram_userId }).populate(
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

}
