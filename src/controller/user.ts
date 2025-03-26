import Dispatcher from "../utils/dispatcher";
import { Request, Response } from "express";
import UserService from "../service/user";

export default class UserController {
  static async createUser(req: Request, res: Response) {
    try {
      const user = await UserService.createUser(req.body);
      Dispatcher.DispatchSuccessMessage(res, "User created successfully", user);
    } catch (err:any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }
}
