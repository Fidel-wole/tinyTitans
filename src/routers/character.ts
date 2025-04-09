import CharacterController from "../controller/character";
import { Router } from "express";

const characterRouter = Router();
characterRouter.post("/character/create", CharacterController.createCharacter);
characterRouter.get("/character/:characterId", CharacterController.getCharacter);   
characterRouter.get("/characters", CharacterController.getAllCharacters);
export default characterRouter;