import User from "../model/user";
import { IUser } from "../interface/user";

export default class UserService {
  static async createUser(user: IUser) {
    try {
      let existingUser = await this.getUser(user.telegram_userId);

      if (!existingUser) {
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
    } catch (err:any) {
      throw new Error(err);
    }
  }
}
