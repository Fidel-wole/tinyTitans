import { Battle, BattleOpponents } from "../model/battle";
import User from "../model/user";
import { 
  BattleAction, 
  BattleRewards,
  BattleRequest, 
  BattleResult, 
  BattleStatus, 
  IBattle,
  IBattleOpponent
} from "../interface/battle";
import mongoose from "mongoose";

// Interface for PvP battle request
interface PvpBattleRequest {
  user1_id: string;
  user2_id: string;
  energy_to_spend: number;
}

export default class BattleService {
  /**
   * Start a new battle for a user
   */
  static async startBattle(battleRequest: BattleRequest): Promise<IBattle> {
    try {
      const { telegram_user_id, battle_type, opponent_id, difficulty, energy_to_spend } = battleRequest;
      
      // Validate energy amount
      if (energy_to_spend < 10) {
        throw new Error("Minimum energy required for battle is 10");
      }
      
      // Get the user
      const user = await User.findOne({ telegram_user_id });
      if (!user) {
        throw new Error("User not found");
      }
      
      // Check if user has enough energy
      const currentEnergy = user.calculate_current_energy();
      if (currentEnergy < energy_to_spend) {
        throw new Error(`Not enough energy for battle. Needed: ${energy_to_spend}, Available: ${currentEnergy}`);
      }
      
      // Select opponent based on battle type
      let opponent: IBattleOpponent;
      
      if (battle_type === 'pve') {
        // For PvE, select an NPC opponent based on difficulty
        let difficultyLevel = 0;
        switch(difficulty) {
          case 'easy':
            difficultyLevel = 0;
            break;
          case 'medium':
            difficultyLevel = 1;
            break;
          case 'hard':
            difficultyLevel = 2;
            break;
          default:
            difficultyLevel = Math.min(Math.floor(user.level / 3), BattleOpponents.length - 1);
        }
        
        opponent = BattleOpponents[difficultyLevel];
        
        // Scale opponent stats based on energy spent
        const energyMultiplier = Math.max(1, energy_to_spend / 10 - 0.5);
        opponent = {
          ...opponent,
          power: Math.round(opponent.power * energyMultiplier),
          defense: Math.round(opponent.defense * energyMultiplier),
          health: Math.round(opponent.health * energyMultiplier),
          rewards: {
            ...opponent.rewards,
            min_coins: Math.round(opponent.rewards.min_coins * energyMultiplier),
            max_coins: Math.round(opponent.rewards.max_coins * energyMultiplier),
            experience: Math.round(opponent.rewards.experience * energyMultiplier)
          }
        };
      } else {
        // For PvP battles - to be implemented
        throw new Error("PvP battles are not yet implemented");
      }
      
      // Get user stats from their selected avatar
      const avatar = user.avatars.find(
        (a) => a.character.toString() === user.avatar?.toString()
      );
      
      if (!avatar) {
        throw new Error("User doesn't have a selected avatar");
      }
      
      // Deduct energy from user
      user.energy = currentEnergy - energy_to_spend;
      user.last_energy_update = new Date();
      await user.save();
      
      // Create a new battle
      const battle = new Battle({
        user_id: user._id,
        status: BattleStatus.IN_PROGRESS,
        energy_spent: energy_to_spend,
        coins_earned: 0,
        experience_earned: 0,
        opponent_npc: {
          name: opponent.name,
          level: opponent.level,
          power: opponent.power,
          defense: opponent.defense,
          health: opponent.health,
          image: opponent.image
        },
        battle_data: {
          rounds: [],
          user_stats: {
            initial_health: 100, // Base value
            current_health: 100, // Base value
            power: avatar.stats.power,
            defense: avatar.stats.defense,
            speed: avatar.stats.speed
          },
          opponent_stats: {
            initial_health: opponent.health,
            current_health: opponent.health,
            power: opponent.power,
            defense: opponent.defense,
            speed: opponent.level // Using level as speed for NPCs
          }
        }
      });
      
      await battle.save();
      return battle;
    } catch (err: any) {
      throw new Error(`Error starting battle: ${err.message}`);
    }
  }
  
  /**
   * Start a new PvP battle between two users
   */
  static async startPvpBattle(battleRequest: PvpBattleRequest): Promise<IBattle> {
    try {
      const { user1_id, user2_id, energy_to_spend } = battleRequest;
      
      // Validate energy amount
      if (energy_to_spend < 10) {
        throw new Error("Minimum energy required for battle is 10");
      }
      
      // Get both users
      const user1 = await User.findById(user1_id);
      const user2 = await User.findById(user2_id);
      
      if (!user1 || !user2) {
        throw new Error("One or both users not found");
      }
      
      // Check if both users have enough energy
      const user1Energy = user1.calculate_current_energy();
      const user2Energy = user2.calculate_current_energy();
      
      if (user1Energy < energy_to_spend || user2Energy < energy_to_spend) {
        throw new Error("One or both users do not have enough energy");
      }
      
      // Get user stats from their selected avatars
      const user1Avatar = user1.avatars.find(
        (a) => a.character.toString() === user1.avatar?.toString()
      );
      
      const user2Avatar = user2.avatars.find(
        (a) => a.character.toString() === user2.avatar?.toString()
      );
      
      if (!user1Avatar || !user2Avatar) {
        throw new Error("One or both users don't have a selected avatar");
      }
      
      // Deduct energy from both users
      user1.energy = user1Energy - energy_to_spend;
      user1.last_energy_update = new Date();
      
      user2.energy = user2Energy - energy_to_spend;
      user2.last_energy_update = new Date();
      
      await Promise.all([user1.save(), user2.save()]);
      
      // Create a new battle
      const battle = new Battle({
        user_id: user1._id,
        opponent_id: user2._id, // Store the opponent's ID for PvP
        status: BattleStatus.IN_PROGRESS,
        energy_spent: energy_to_spend,
        coins_earned: 0,
        experience_earned: 0,
        battle_data: {
          rounds: [],
          user_stats: {
            initial_health: 100, // Base value
            current_health: 100, // Base value
            power: user1Avatar.stats.power,
            defense: user1Avatar.stats.defense,
            speed: user1Avatar.stats.speed
          },
          opponent_stats: {
            initial_health: 100, // Base value
            current_health: 100, // Base value
            power: user2Avatar.stats.power,
            defense: user2Avatar.stats.defense,
            speed: user2Avatar.stats.speed
          }
        }
      });
      
      await battle.save();
      return battle;
    } catch (err: any) {
      throw new Error(`Error starting PvP battle: ${err.message}`);
    }
  }
  
  /**
   * Process a battle turn
   */
  static async processBattleTurn(battleId: string, userAction: BattleAction): Promise<IBattle> {
    try {
      const battle = await Battle.findById(battleId);
      if (!battle) {
        throw new Error("Battle not found");
      }
      
      if (battle.status !== BattleStatus.IN_PROGRESS) {
        throw new Error(`Battle is not in progress. Current status: ${battle.status}`);
      }
      
      // Check if this is a PvP battle (has opponent_id)
      if (battle.opponent_id) {
        // For PvP battles, we'll need special handling
        // This is a simplified version - in a real implementation, 
        // we'd need to coordinate both players' actions
        
        // For now, we'll simulate the opponent's action
        const opponentAction = this.generateOpponentAction();
        
        // Process the turn
        const { user_stats, opponent_stats } = battle.battle_data;
        const roundResult = this.calculateRoundResult(
          userAction,
          opponentAction,
          user_stats,
          opponent_stats
        );
        
        // Update stats based on round result
        user_stats.current_health = Math.max(0, user_stats.current_health - roundResult.damage_to_user);
        opponent_stats.current_health = Math.max(0, opponent_stats.current_health - roundResult.damage_to_opponent);
        
        // Add this round to battle data
        const roundNumber = battle.battle_data.rounds.length + 1;
        battle.battle_data.rounds.push({
          round_number: roundNumber,
          user_action: userAction,
          opponent_action: opponentAction,
          result: roundResult.description
        });
        
        // Check if battle is over
        if (user_stats.current_health <= 0 || opponent_stats.current_health <= 0) {
          return this.completeBattle(battle);
        }
        
        await battle.save();
        return battle;
      } else {
        // For PvE battles, continue with existing logic
        const opponentAction = this.generateOpponentAction();
        
        // Process the turn
        const { user_stats, opponent_stats } = battle.battle_data;
        const roundResult = this.calculateRoundResult(
          userAction,
          opponentAction,
          user_stats,
          opponent_stats
        );
        
        // Update stats based on round result
        user_stats.current_health = Math.max(0, user_stats.current_health - roundResult.damage_to_user);
        opponent_stats.current_health = Math.max(0, opponent_stats.current_health - roundResult.damage_to_opponent);
        
        // Add this round to battle data
        const roundNumber = battle.battle_data.rounds.length + 1;
        battle.battle_data.rounds.push({
          round_number: roundNumber,
          user_action: userAction,
          opponent_action: opponentAction,
          result: roundResult.description
        });
        
        // Check if battle is over
        if (user_stats.current_health <= 0 || opponent_stats.current_health <= 0) {
          return this.completeBattle(battle);
        }
        
        await battle.save();
        return battle;
      }
    } catch (err: any) {
      throw new Error(`Error processing battle turn: ${err.message}`);
    }
  }
  
  /**
   * Process a PvP battle based on who attacked first and avatar stats
   */
  static async processPvpBattle(battleId: string): Promise<IBattle> {
    try {
      const battle = await Battle.findById(battleId);
      if (!battle) {
        throw new Error("Battle not found");
      }
      
      if (battle.status !== BattleStatus.IN_PROGRESS) {
        throw new Error(`Battle is not in progress. Current status: ${battle.status}`);
      }
      
      // Make sure this is a PvP battle
      if (!battle.opponent_id) {
        throw new Error("This is not a PvP battle");
      }
      
      // Determine battle outcome based on avatar stats and who attacked first
      const { user_stats, opponent_stats } = battle.battle_data;
      
      // Calculate total stat power for each player
      const userStatPower = user_stats.power + user_stats.defense + user_stats.speed;
      const opponentStatPower = opponent_stats.power + opponent_stats.defense + opponent_stats.speed;
      
      // Get who attacked first (this was set by the socket handler)
      const firstAttacker = battle.first_attacker || 'user'; // Default to user if not set
      
      // Create a round with both players attacking
      const roundNumber = battle.battle_data.rounds.length + 1;
      const timestamp = Date.now();
      
      // Determine damage based on stats and who attacked first
      // First attacker gets a 20% damage bonus
      let damageToUser = opponent_stats.power - (user_stats.defense * 0.5);
      let damageToOpponent = user_stats.power - (opponent_stats.defense * 0.5);
      
      // Apply first attacker bonus
      if (firstAttacker === 'user') {
        damageToOpponent *= 1.2; // 20% bonus for first attacker
        
        // If first attacker has higher stats, they get an additional 20% bonus
        if (userStatPower > opponentStatPower) {
          damageToOpponent *= 1.2;
        }
      } else {
        damageToUser *= 1.2; // 20% bonus for first attacker
        
        // If first attacker has higher stats, they get an additional 20% bonus
        if (opponentStatPower > userStatPower) {
          damageToUser *= 1.2;
        }
      }
      
      // Ensure minimum damage
      damageToUser = Math.max(5, Math.round(damageToUser));
      damageToOpponent = Math.max(5, Math.round(damageToOpponent));
      
      // Create a description
      let roundDescription = '';
      if (firstAttacker === 'user') {
        roundDescription = `You attacked first! You deal ${damageToOpponent} damage. Opponent counters for ${damageToUser} damage.`;
      } else {
        roundDescription = `Opponent attacked first! They deal ${damageToUser} damage. You counter for ${damageToOpponent} damage.`;
      }
      
      // Update health values
      user_stats.current_health = Math.max(0, user_stats.current_health - damageToUser);
      opponent_stats.current_health = Math.max(0, opponent_stats.current_health - damageToOpponent);
      
      // Add this round to battle data
      battle.battle_data.rounds.push({
        round_number: roundNumber,
        user_action: { type: 'attack' },
        opponent_action: { type: 'attack' },
        result: roundDescription,
        timestamp // Add timestamp
      });
      
      // Check if battle is over (one or both players have 0 health)
      if (user_stats.current_health <= 0 || opponent_stats.current_health <= 0) {
        // Complete the battle
        if (user_stats.current_health <= 0 && opponent_stats.current_health <= 0) {
          // Both died - draw
          battle.result = BattleResult.DRAW;
        } else if (user_stats.current_health <= 0) {
          // User died - defeat
          battle.result = BattleResult.DEFEAT;
        } else {
          // Opponent died - victory
          battle.result = BattleResult.VICTORY;
        }
        
        battle.status = BattleStatus.COMPLETED;
        battle.completed_at = new Date();
        
        // Calculate rewards based on energy spent
        const baseCoins = battle.energy_spent * 5;
        const baseExp = battle.energy_spent * 2;
        
        // Rewards depend on battle result
        switch (battle.result) {
          case BattleResult.VICTORY:
            battle.coins_earned = baseCoins;
            battle.experience_earned = baseExp;
            break;
          case BattleResult.DRAW:
            battle.coins_earned = Math.floor(baseCoins * 0.5);
            battle.experience_earned = Math.floor(baseExp * 0.5);
            break;
          case BattleResult.DEFEAT:
            battle.coins_earned = Math.floor(baseCoins * 0.2); // Consolation prize
            battle.experience_earned = Math.floor(baseExp * 0.2);
            break;
        }
        
        // Update players' stats in the database
        await this.updatePlayerStatsAfterPvpBattle(battle);
      }
      
      await battle.save();
      return battle;
    } catch (err: any) {
      throw new Error(`Error processing PvP battle: ${err.message}`);
    }
  }
  
  /**
   * Update both players' stats after a PvP battle
   */
  private static async updatePlayerStatsAfterPvpBattle(battle: IBattle): Promise<void> {
    try {
      // Get both users
      const user1 = await User.findById(battle.user_id);
      const user2 = await User.findById(battle.opponent_id);
      
      if (!user1 || !user2) {
        throw new Error("One or both users not found");
      }
      
      // Update stats based on battle result
      if (battle.result === BattleResult.VICTORY) {
        // User 1 won
        user1.coins += battle.coins_earned;
        
        // Find user1's avatar and add experience
        const avatar1 = user1.avatars.find(
          (a) => a.character.toString() === user1.avatar?.toString()
        );
        
        if (avatar1) {
          avatar1.stats.experience += battle.experience_earned;
          
          // Level up logic
          if (avatar1.stats.experience >= avatar1.stats.experience_needed) {
            avatar1.stats.experience -= avatar1.stats.experience_needed;
            avatar1.stats.experience_needed = Math.floor(avatar1.stats.experience_needed * 1.5);
            user1.skill_points += 1;
            user1.level += 1;
          }
        }
        
        // Loser gets a small consolation prize
        user2.coins += Math.floor(battle.coins_earned * 0.2);
        
      } else if (battle.result === BattleResult.DEFEAT) {
        // User 2 won
        user2.coins += battle.coins_earned;
        
        // Find user2's avatar and add experience
        const avatar2 = user2.avatars.find(
          (a) => a.character.toString() === user2.avatar?.toString()
        );
        
        if (avatar2) {
          avatar2.stats.experience += battle.experience_earned;
          
          // Level up logic
          if (avatar2.stats.experience >= avatar2.stats.experience_needed) {
            avatar2.stats.experience -= avatar2.stats.experience_needed;
            avatar2.stats.experience_needed = Math.floor(avatar2.stats.experience_needed * 1.5);
            user2.skill_points += 1;
            user2.level += 1;
          }
        }
        
        // Loser gets a small consolation prize
        user1.coins += Math.floor(battle.coins_earned * 0.2);
        
      } else if (battle.result === BattleResult.DRAW) {
        // Draw - both get half rewards
        user1.coins += Math.floor(battle.coins_earned / 2);
        user2.coins += Math.floor(battle.coins_earned / 2);
        
        // Find avatars and add experience
        const avatar1 = user1.avatars.find(
          (a) => a.character.toString() === user1.avatar?.toString()
        );
        
        const avatar2 = user2.avatars.find(
          (a) => a.character.toString() === user2.avatar?.toString()
        );
        
        if (avatar1) {
          avatar1.stats.experience += Math.floor(battle.experience_earned / 2);
        }
        
        if (avatar2) {
          avatar2.stats.experience += Math.floor(battle.experience_earned / 2);
        }
      }
      
      // Save both users
      await Promise.all([user1.save(), user2.save()]);
    } catch (err: any) {
      console.error(`Error updating player stats: ${err.message}`);
      throw err;
    }
  }
  
  /**
   * Complete a battle and give rewards
   */
  private static async completeBattle(battle: IBattle): Promise<IBattle> {
    try {
      const { user_stats, opponent_stats } = battle.battle_data;
      
      // Determine battle result
      if (user_stats.current_health <= 0 && opponent_stats.current_health <= 0) {
        battle.result = BattleResult.DRAW;
      } else if (user_stats.current_health <= 0) {
        battle.result = BattleResult.DEFEAT;
      } else {
        battle.result = BattleResult.VICTORY;
      }
      
      // Calculate rewards
      const rewards = this.calculateRewards(battle);
      
      // Update battle with rewards
      battle.coins_earned = rewards.coins;
      battle.experience_earned = rewards.experience;
      battle.status = BattleStatus.COMPLETED;
      battle.completed_at = new Date();
      
      // Apply rewards - different for PvP and PvE
      if (battle.opponent_id) {
        // PvP battle
        const user1 = await User.findById(battle.user_id);
        const user2 = await User.findById(battle.opponent_id);
        
        if (user1 && user2) {
          if (battle.result === BattleResult.VICTORY) {
            // User 1 wins
            user1.coins += rewards.coins;
            
            // Find user1's avatar and add experience
            const avatar1 = user1.avatars.find(
              (a) => a.character.toString() === user1.avatar?.toString()
            );
            
            if (avatar1) {
              avatar1.stats.experience += rewards.experience;
              
              // Level up logic
              if (avatar1.stats.experience >= avatar1.stats.experience_needed) {
                avatar1.stats.experience -= avatar1.stats.experience_needed;
                avatar1.stats.experience_needed = Math.floor(avatar1.stats.experience_needed * 1.5);
                user1.skill_points += 1;
                user1.level += 1;
              }
            }
            
            // Loser gets a small consolation prize
            user2.coins += Math.floor(rewards.coins * 0.2);
            
          } else if (battle.result === BattleResult.DEFEAT) {
            // User 2 wins
            user2.coins += rewards.coins;
            
            // Find user2's avatar and add experience
            const avatar2 = user2.avatars.find(
              (a) => a.character.toString() === user2.avatar?.toString()
            );
            
            if (avatar2) {
              avatar2.stats.experience += rewards.experience;
              
              // Level up logic
              if (avatar2.stats.experience >= avatar2.stats.experience_needed) {
                avatar2.stats.experience -= avatar2.stats.experience_needed;
                avatar2.stats.experience_needed = Math.floor(avatar2.stats.experience_needed * 1.5);
                user2.skill_points += 1;
                user2.level += 1;
              }
            }
            
            // Loser gets a small consolation prize
            user1.coins += Math.floor(rewards.coins * 0.2);
            
          } else if (battle.result === BattleResult.DRAW) {
            // Draw - both get half rewards
            user1.coins += Math.floor(rewards.coins / 2);
            user2.coins += Math.floor(rewards.coins / 2);
            
            // Find avatars and add experience
            const avatar1 = user1.avatars.find(
              (a) => a.character.toString() === user1.avatar?.toString()
            );
            
            const avatar2 = user2.avatars.find(
              (a) => a.character.toString() === user2.avatar?.toString()
            );
            
            if (avatar1) {
              avatar1.stats.experience += Math.floor(rewards.experience / 2);
            }
            
            if (avatar2) {
              avatar2.stats.experience += Math.floor(rewards.experience / 2);
            }
          }
          
          await Promise.all([user1.save(), user2.save()]);
        }
        
      } else {
        // PvE battle - use existing logic
        if (battle.result === BattleResult.VICTORY || battle.result === BattleResult.DRAW) {
          const user = await User.findById(battle.user_id);
          if (user) {
            user.coins += rewards.coins;
            
            // Find the current avatar and add experience
            const avatar = user.avatars.find(
              (a) => a.character.toString() === user.avatar?.toString()
            );
            
            if (avatar) {
              avatar.stats.experience += rewards.experience;
              
              // Level up logic if experience exceeds needed amount
              if (avatar.stats.experience >= avatar.stats.experience_needed) {
                avatar.stats.experience -= avatar.stats.experience_needed;
                avatar.stats.experience_needed = Math.floor(avatar.stats.experience_needed * 1.5);
                user.skill_points += 1;
                user.level += 1;
              }
            }
            
            await user.save();
          }
        }
      }
      
      await battle.save();
      return battle;
    } catch (err: any) {
      throw new Error(`Error completing battle: ${err.message}`);
    }
  }
  
  /**
   * Calculate rewards for a battle
   */
  private static calculateRewards(battle: IBattle): BattleRewards {
    // For PvP battles, rewards are calculated differently
    if (battle.opponent_id) {
      // Base PvP rewards depend on energy spent
      const baseCoins = battle.energy_spent * 5;
      const baseExp = battle.energy_spent * 2;
      
      // Modify rewards based on battle result
      let rewardMultiplier = 0;
      
      switch (battle.result) {
        case BattleResult.VICTORY:
          rewardMultiplier = 1.0;
          break;
        case BattleResult.DRAW:
          rewardMultiplier = 0.5;
          break;
        case BattleResult.DEFEAT:
          rewardMultiplier = 0.2; // Small consolation prize
          break;
        default:
          rewardMultiplier = 0;
      }
      
      return {
        coins: Math.floor(baseCoins * rewardMultiplier),
        experience: Math.floor(baseExp * rewardMultiplier)
      };
    } else {
      // For PvE battles, use existing logic
      const { result, opponent_npc, energy_spent } = battle;
      
      // Base rewards
      let baseCoins = 0;
      let baseExp = 0;
      
      if (opponent_npc) {
        const opponent = BattleOpponents.find(o => o.name === opponent_npc.name);
        if (opponent) {
          // Calculate base rewards from opponent
          baseCoins = Math.floor(
            Math.random() * (opponent.rewards.max_coins - opponent.rewards.min_coins + 1) 
            + opponent.rewards.min_coins
          );
          baseExp = opponent.rewards.experience;
        }
      }
      
      // Modify rewards based on battle result
      let rewardMultiplier = 0;
      
      switch (result) {
        case BattleResult.VICTORY:
          rewardMultiplier = 1.0;
          break;
        case BattleResult.DRAW:
          rewardMultiplier = 0.5;
          break;
        case BattleResult.DEFEAT:
          rewardMultiplier = 0.2; // Small consolation prize
          break;
        default:
          rewardMultiplier = 0;
      }
      
      // Scale with energy spent
      const energyScaling = Math.max(1, energy_spent / 10);
      
      return {
        coins: Math.floor(baseCoins * rewardMultiplier * energyScaling),
        experience: Math.floor(baseExp * rewardMultiplier * energyScaling)
      };
    }
  }
  
  /**
   * Calculate the result of a battle round
   */
  private static calculateRoundResult(
    userAction: BattleAction,
    opponentAction: BattleAction,
    userStats: any,
    opponentStats: any
  ) {
    let damageToUser = 0;
    let damageToOpponent = 0;
    let description = "";

    // Base damage calculations
    const userBaseDamage = Math.max(1, userStats.power - opponentStats.defense / 2);
    const opponentBaseDamage = Math.max(1, opponentStats.power - userStats.defense / 2);

    // Speed affects who hits first and chance of critical hits
    const userIsFirst = userStats.speed >= opponentStats.speed;
    
    // Determine critical hit chances (higher speed = higher chance)
    const userCritChance = Math.min(0.2, userStats.speed / 100);
    const opponentCritChance = Math.min(0.2, opponentStats.speed / 100);
    
    // Check for critical hits
    const userCritical = Math.random() < userCritChance;
    const opponentCritical = Math.random() < opponentCritChance;

    // Apply action-specific modifiers
    if (userAction.type === "attack") {
      // Attack does full damage
      damageToOpponent = userBaseDamage * (userCritical ? 1.5 : 1);
      
      if (opponentAction.type === "attack") {
        // Both attacking - full damage to both
        damageToUser = opponentBaseDamage * (opponentCritical ? 1.5 : 1);
        
        description = userIsFirst ? 
          `You attack for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}. Opponent attacks for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}.` :
          `Opponent attacks for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}. You attack for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}.`;
      } 
      else if (opponentAction.type === "defend") {
        // Opponent defends - reduce damage to opponent by 50%
        damageToOpponent = Math.max(1, damageToOpponent * 0.5);
        damageToUser = Math.max(0, opponentBaseDamage * 0.3); // Counter-attack does 30% damage
        
        description = `You attack for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""} but opponent defends, reducing damage. Opponent counter-attacks for ${Math.round(damageToUser)} damage.`;
      }
      else if (opponentAction.type === "special") {
        // Special has a 40% chance to completely avoid damage and counter with a powerful attack
        if (Math.random() < 0.4) {
          damageToOpponent = 0;
          damageToUser = opponentBaseDamage * 1.8 * (opponentCritical ? 1.5 : 1);
          description = `Opponent uses a special move and dodges your attack! They counter with a powerful strike for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}.`;
        } else {
          // Special failed, take full damage and deal increased damage
          damageToOpponent = userBaseDamage * (userCritical ? 1.5 : 1);
          damageToUser = opponentBaseDamage * 1.4 * (opponentCritical ? 1.5 : 1);
          description = `You attack for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}. Opponent's special move fails but still deals ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}.`;
        }
      }
    }
    else if (userAction.type === "defend") {
      // Defending reduces incoming damage by 50%
      if (opponentAction.type === "attack") {
        damageToUser = Math.max(1, opponentBaseDamage * 0.5) * (opponentCritical ? 1.5 : 1);
        damageToOpponent = Math.max(0, userBaseDamage * 0.3); // Counter-attack does 30% damage
        
        description = `You defend against opponent's attack, reducing damage to ${Math.round(damageToUser)}${opponentCritical ? " (Critical Hit!)" : ""}. You counter-attack for ${Math.round(damageToOpponent)} damage.`;
      }
      else if (opponentAction.type === "defend") {
        // Both defending - minimal damage
        damageToUser = 1;
        damageToOpponent = 1;
        
        description = "Both of you defend. Stalemate!";
      }
      else if (opponentAction.type === "special") {
        // Special vs defend - special pierces some defense
        damageToUser = Math.max(2, opponentBaseDamage * 0.7) * (opponentCritical ? 1.5 : 1);
        damageToOpponent = 0;
        
        description = `Opponent's special move partially penetrates your defense for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}.`;
      }
    }
    else if (userAction.type === "special") {
      // Special has a 40% chance to completely avoid damage and counter with a powerful attack
      if (opponentAction.type === "attack") {
        if (Math.random() < 0.4) {
          damageToUser = 0;
          damageToOpponent = userBaseDamage * 1.8 * (userCritical ? 1.5 : 1);
          description = `Your special move allows you to dodge opponent's attack! You counter with a powerful strike for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}.`;
        } else {
          // Special failed, take full damage and deal increased damage
          damageToUser = opponentBaseDamage * (opponentCritical ? 1.5 : 1);
          damageToOpponent = userBaseDamage * 1.4 * (userCritical ? 1.5 : 1);
          description = `Your special move fails. Opponent hits for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}, but you still deal ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}.`;
        }
      }
      else if (opponentAction.type === "defend") {
        // Special vs defend - special pierces some defense
        damageToOpponent = Math.max(2, userBaseDamage * 0.7) * (userCritical ? 1.5 : 1);
        damageToUser = 0;
        
        description = `Your special move partially penetrates opponent's defense for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}.`;
      }
      else if (opponentAction.type === "special") {
        // Both using special - high damage on both sides
        damageToUser = opponentBaseDamage * 1.3 * (opponentCritical ? 1.5 : 1);
        damageToOpponent = userBaseDamage * 1.3 * (userCritical ? 1.5 : 1);
        
        description = userIsFirst ?
          `Your special attack hits for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}. Opponent's special attack hits for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}.` :
          `Opponent's special attack hits for ${Math.round(damageToUser)} damage${opponentCritical ? " (Critical Hit!)" : ""}. Your special attack hits for ${Math.round(damageToOpponent)} damage${userCritical ? " (Critical Hit!)" : ""}.`;
      }
    }

    // Return the calculated damages and description
    return {
      damage_to_user: Math.round(damageToUser),
      damage_to_opponent: Math.round(damageToOpponent),
      description
    };
  }
  
  /**
   * Generate a random action for the opponent
   */
  private static generateOpponentAction(): BattleAction {
    const actionTypes = ['attack', 'defend', 'special'] as const;
    const weights = [0.7, 0.2, 0.1]; // 70% attack, 20% defend, 10% special
    
    // Weighted random selection
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedType: typeof actionTypes[number] = actionTypes[0];
    
    for (let i = 0; i < actionTypes.length; i++) {
      cumulativeWeight += weights[i];
      if (random < cumulativeWeight) {
        selectedType = actionTypes[i];
        break;
      }
    }
    
    return {
      type: selectedType
    };
  }
  
  /**
   * Get all battles for a user
   */
  static async getUserBattles(telegram_user_id: string): Promise<IBattle[]> {
    try {
      const user = await User.findOne({ telegram_user_id });
      if (!user) {
        throw new Error("User not found");
      }
      
      const battles = await Battle.find({ user_id: user._id })
        .sort({ created_at: -1 })
        .limit(10);
      
      return battles;
    } catch (err: any) {
      throw new Error(`Error fetching user battles: ${err.message}`);
    }
  }
  
  /**
   * Get a specific battle by ID
   */
  static async getBattleById(battleId: string): Promise<IBattle> {
    try {
      const battle = await Battle.findById(battleId);
      if (!battle) {
        throw new Error("Battle not found");
      }
      
      return battle;
    } catch (err: any) {
      throw new Error(`Error fetching battle: ${err.message}`);
    }
  }
  
  /**
   * Auto-resolve a battle (for quick battles)
   */
  static async autoResolveBattle(battleId: string): Promise<IBattle> {
    try {
      const battle = await Battle.findById(battleId);
      if (!battle) {
        throw new Error("Battle not found");
      }
      
      if (battle.status !== BattleStatus.IN_PROGRESS) {
        throw new Error(`Battle is not in progress. Current status: ${battle.status}`);
      }
      
      const { user_stats, opponent_stats } = battle.battle_data;
      const MAX_ROUNDS = 10;
      
      // Simulate rounds until someone wins or we reach max rounds
      for (let i = 0; i < MAX_ROUNDS; i++) {
        // Both choose to attack for simplicity
        const userAction: BattleAction = { type: 'attack' };
        const opponentAction: BattleAction = { type: 'attack' };
        
        const roundResult = this.calculateRoundResult(
          userAction,
          opponentAction,
          user_stats,
          opponent_stats
        );
        
        // Update stats based on round result
        user_stats.current_health = Math.max(0, user_stats.current_health - roundResult.damage_to_user);
        opponent_stats.current_health = Math.max(0, opponent_stats.current_health - roundResult.damage_to_opponent);
        
        // Add this round to battle data
        const roundNumber = battle.battle_data.rounds.length + 1;
        battle.battle_data.rounds.push({
          round_number: roundNumber,
          user_action: userAction,
          opponent_action: opponentAction,
          result: roundResult.description
        });
        
        // Check if battle is over
        if (user_stats.current_health <= 0 || opponent_stats.current_health <= 0) {
          break;
        }
      }
      
      // Force an end if we reached max rounds
      if (user_stats.current_health > 0 && opponent_stats.current_health > 0) {
        // Whoever has more health remaining wins
        if (user_stats.current_health > opponent_stats.current_health) {
          opponent_stats.current_health = 0;
        } else {
          user_stats.current_health = 0;
        }
      }
      
      // Complete the battle and give rewards
      return this.completeBattle(battle);
    } catch (err: any) {
      throw new Error(`Error auto-resolving battle: ${err.message}`);
    }
  }
  
  /**
   * Get available opponents for a user
   */
  static async getAvailableOpponents(): Promise<IBattleOpponent[]> {
    return BattleOpponents;
  }
}