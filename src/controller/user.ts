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
    } catch (err:any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  static async getUser(req: Request, res: Response) {
    try {
      const { telegram_userId } = req.params;
      const user = await UserService.getUser(telegram_userId);
      Dispatcher.DispatchSuccessMessage(res, "User fetched successfully", user);
    } catch (err:any) {
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
    } catch (err:any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }
}
