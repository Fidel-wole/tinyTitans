import CharacterService from "../service/character";
import { Request, Response } from "express";
import { ICharacter } from "../interface/avatar";
import Dispatcher from "../utils/dispatcher";

export default class CharacterController {
  static async createCharacter(req: Request, res: Response) {
    try {
      const data: ICharacter = req.body;
      const character = await CharacterService.createCharacter(data);
      Dispatcher.DispatchSuccessMessage(
        res,
        "Character created successfully",
        character
      );
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  static async getCharacter(req: Request, res: Response) {
    try {
      const { characterId } = req.params;
      const character = await CharacterService.getCharacter(characterId);
      Dispatcher.DispatchSuccessMessage(
        res,
        "Character fetched successfully",
        character
      );
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }

  static async getAllCharacters(req: Request, res: Response) {
    try {
      const characters = await CharacterService.getAllCharacters();
      Dispatcher.DispatchSuccessMessage(
        res,
        "Characters fetched successfully",
        characters
      );
    } catch (err: any) {
      Dispatcher.DispatchErrorMessage(res, err.message);
    }
  }
}
