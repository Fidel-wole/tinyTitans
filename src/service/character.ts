import { Character } from "../model/character";
import { ICharacter } from "../interface/avatar";

export default class CharacterService {
  static async createCharacter(data: ICharacter) {
    try {
      const character = await Character.create(data);
      return character;
    } catch (err: any) {
      throw new Error(err.message);
    }
  }

    static async getCharacter(characterId: string) {
        try {
        const character = await Character.findById(characterId);
        if (!character) {
            throw new Error("Character not found");
        }
        return character;
        } catch (err: any) {
        throw new Error(err.message);
        }
    }

    static async getAllCharacters() {
        try {
            const characters = await Character.find();
            return characters;
        } catch (err: any) {
            throw new Error(err.message);
        }
    }
}
