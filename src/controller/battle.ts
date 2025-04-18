import { Request, Response } from "express";
import BattleService from "../service/battle";
import Dispatcher from "../utils/dispatcher";
import { BattleAction, BattleRequest } from "../interface/battle";

export default class BattleController {
  /**
   * Start a new battle for a user
   */
  static async startBattle(req: Request, res: Response): Promise<void> {
    try {
      const battleRequest: BattleRequest = req.body;
      const battle = await BattleService.startBattle(battleRequest);
      
      Dispatcher.DispatchSuccessMessage(
        res,
        "Battle started successfully",
        battle
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
  
  /**
   * Process a battle turn
   */
  static async processBattleTurn(req: Request, res: Response): Promise<void> {
    try {
      const { battleId } = req.params;
      const userAction: BattleAction = req.body;
      
      const battle = await BattleService.processBattleTurn(battleId, userAction);
      
      Dispatcher.DispatchSuccessMessage(
        res,
        "Battle turn processed successfully",
        battle
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
  
  /**
   * Auto-resolve a battle
   */
  static async autoResolveBattle(req: Request, res: Response): Promise<void> {
    try {
      const { battleId } = req.params;
      
      const battle = await BattleService.autoResolveBattle(battleId);
      
      Dispatcher.DispatchSuccessMessage(
        res,
        "Battle auto-resolved successfully",
        battle
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
  
  /**
   * Get all battles for a user
   */
  static async getUserBattles(req: Request, res: Response): Promise<void> {
    try {
      const { telegram_user_id } = req.params;
      
      const battles = await BattleService.getUserBattles(telegram_user_id);
      
      Dispatcher.DispatchSuccessMessage(
        res,
        "User battles fetched successfully",
        battles
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
  
  /**
   * Get a specific battle by ID
   */
  static async getBattleById(req: Request, res: Response): Promise<void> {
    try {
      const { battleId } = req.params;
      
      const battle = await BattleService.getBattleById(battleId);
      
      Dispatcher.DispatchSuccessMessage(
        res,
        "Battle fetched successfully",
        battle
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
  
  /**
   * Get available opponents for battles
   */
  static async getAvailableOpponents(req: Request, res: Response): Promise<void> {
    try {
      const opponents = await BattleService.getAvailableOpponents();
      
      Dispatcher.DispatchSuccessMessage(
        res,
        "Available opponents fetched successfully",
        opponents
      );
    } catch (error: any) {
      Dispatcher.DispatchErrorMessage(res, error.message);
    }
  }
}