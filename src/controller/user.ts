import Dispatcher from "../utils/dispatcher";
import { Request, Response } from "express";
import UserService from "../service/user";
import { generateReferralCode } from "../utils/strings";
import { IUser } from "../interface/user";

export default class UserController {
  static async createUser(req: Request, res: Response) {
    try {
      const data: IUser = req.body;
      data.referral_code = generateReferralCode();
      const user = await UserService.createUser(req.body);
      Dispatcher.DispatchSuccessMessage(res, "User created successfully", user);
    } catch (err:any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }
}
