import { Router } from "express";
import BattleController from "../controller/battle";

const battleRouter = Router();

// Start a new battle
battleRouter.post("/battle/start", BattleController.startBattle);

// Process a battle turn
battleRouter.post("/battle/:battleId/turn", BattleController.processBattleTurn);

// Auto-resolve a battle (quick battle)
battleRouter.post("/battle/:battleId/auto-resolve", BattleController.autoResolveBattle);

// Get all battles for a user
battleRouter.get("/battles/:telegram_user_id", BattleController.getUserBattles);

// Get a specific battle by ID
battleRouter.get("/battle/:battleId", BattleController.getBattleById);

// Get available opponents
battleRouter.get("/battle/opponents", BattleController.getAvailableOpponents);

export default battleRouter;