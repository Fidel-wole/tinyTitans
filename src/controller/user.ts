import Dispatcher from "../utils/dispatcher";
import { Request, Response } from "express";
import UserService from "../service/user";
import { IUser } from "../interface/user";

export default class UserController {
  static async createUser(req: Request, res: Response) {
    try {
      const data: IUser = req.body;
      const user = await UserService.createUser(req.body);
      Dispatcher.DispatchSuccessMessage(res, "User created successfully", user);
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  static async getUser(req: Request, res: Response) {
    try {
      const { telegram_userId } = req.params;
      const user = await UserService.getUser(telegram_userId);
      Dispatcher.DispatchSuccessMessage(res, "User fetched successfully", user);
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  static async getReferrals(req: Request, res: Response) {
    try {
      const { telegram_userId } = req.params;
      const referrals = await UserService.getReferrals(telegram_userId);
      Dispatcher.DispatchSuccessMessage(
        res,
        "Referrals fetched successfully",
        referrals
      );
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }
  static async getLeaderboard(req: Request, res: Response) {
    try {
      const leaderboard = await UserService.getLeaderboard();
      Dispatcher.DispatchSuccessMessage(
        res,
        "Leaderboard fetched successfully",
        leaderboard
      );
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }
  static async selectCharacter(req: Request, res: Response) {
    try {
      const { telegram_userId } = req.params;
      const { characterId } = req.body;

      const user = await UserService.selectCharacter(
        telegram_userId,
        characterId
      );

      Dispatcher.DispatchSuccessMessage(
        res,
        "Character selected successfully",
        user
      );
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const { telegram_user_id } = req.params;
      const data: Partial<IUser> = req.body;
      const user = await UserService.updateUser(telegram_user_id, data);
      Dispatcher.DispatchSuccessMessage(res, "User updated successfully", user);
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  /**
   * Get user profile statistics including battles, wins, coins earned, tasks and referrals
   * @param req Express request object
   * @param res Express response object
   */
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { telegram_userId } = req.params;
      const profile = await UserService.getUserProfile(telegram_userId);

      if (!profile) {
        Dispatcher.DispatchErrorMessage(res, "User not found");
        return;
      }

      Dispatcher.DispatchSuccessMessage(
        res,
        "User profile fetched successfully",
        profile
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
}
