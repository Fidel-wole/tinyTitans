import { Server, Socket } from "socket.io";
import User, { IUserModel } from "../model/user";
import mongoose from "mongoose";
import BattleService from "./battle";
import { BattleAction, BattleRequest, BattleResult } from "../interface/battle";

interface TapPayload {
  telegram_user_id: string;
}

interface BattleStartPayload extends BattleRequest {}

interface BattleTurnPayload {
  battle_id: string;
  action: BattleAction;
}

// User data cache to maintain functionality during DB outages
interface UserCache {
  telegramUserId: string;
  coins: number;
  energy: number;
  max_energy: number;
  energy_regen_rate: number;
  last_energy_update: Date;
  lastSynced: number; // timestamp of last successful DB sync
  pendingTaps: number; // taps collected during DB outage
  pendingSave: boolean; // whether we need to save to DB
  activeBattleId?: string; // Track active battle for the user
  avatarStats?: {
    power: number;
    defense: number;
    speed: number;
    health: number; // Added health for battle calculations
  }; // Track user's avatar stats for matchmaking
  readyForPvp?: boolean; // Whether user is waiting for matchmaking
}

// Matchmaking data structure
interface MatchmakingUser {
  socketId: string;
  telegram_user_id: string;
  userId: string; // MongoDB ObjectId
  energy_to_spend: number;
  timestamp: number;
  userLevel: number; // User's level for level-based matchmaking
  avatarStats: {
    power: number;
    defense: number;
    speed: number;
    health: number; // Added health for battle calculations
  };
}

// For tracking PvP battles and attack timestamps
interface PvpBattleState {
  battleId: string;
  user1Id: string;
  user2Id: string;
  user1Socket: string;
  user2Socket: string;
  user1Attacked: boolean;
  user2Attacked: boolean;
  user1AttackTime?: number;
  user2AttackTime?: number;
}

const userIntervals = new Map<string, NodeJS.Timeout>();
const userCaches = new Map<string, UserCache>(); // In-memory cache for users
const matchmakingQueue: MatchmakingUser[] = []; // Users waiting for a PvP match
const activePvpBattles = new Map<string, PvpBattleState>(); // Track active PvP battles
const BATCH_PROCESS_INTERVAL = 50; // Process batches every 50ms for more responsive feel
const SYNC_INTERVAL = 2000; // Sync to DB every 2 seconds to reduce DB load
const MATCHMAKING_INTERVAL = 3000; // Run matchmaking every 3 seconds

export const registerSocketHandlers = (io: Server): void => {
  // Set up matchmaking interval
  setInterval(() => {
    processMatchmaking(io);
  }, MATCHMAKING_INTERVAL);

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    let telegramUserId: string | null = null;
    let isTapping: boolean = false;
    let isBattling: boolean = false;
    let dbOffline: boolean = false;
    let syncInterval: NodeJS.Timeout | null = null;

    // 🟢 Start background energy regen when user initializes
    socket.on("initUser", async (data: TapPayload) => {
      telegramUserId = data.telegram_user_id;

      if (!telegramUserId) {
        return socket.emit("error", { message: "Invalid user ID" });
      }

      try {
        // Check if DB is connected first
        const isDbConnected = mongoose.connection.readyState === 1;

        if (!isDbConnected) {
          dbOffline = true;
          return socket.emit("error", {
            message:
              "Database is currently offline. Some features may be limited.",
          });
        }

        const user = (await User.findOne({
          telegram_user_id: telegramUserId,
        })) as IUserModel;
        if (!user) {
          return socket.emit("error", { message: "User not found" });
        }

        // Get user's avatar stats for matchmaking
        let avatarStats = { power: 10, defense: 5, speed: 5, health: 100 }; // Default values

        if (user.avatar) {
          const selectedAvatar = user.avatars.find(
            (a) => a.character.toString() === user.avatar?.toString()
          );

          if (selectedAvatar) {
            avatarStats = {
              power: selectedAvatar.stats.power,
              defense: selectedAvatar.stats.defense,
              speed: selectedAvatar.stats.speed,
              health: selectedAvatar.stats.health || 100, // Default health if not provided
            };
          }
        }

        // Cache user data in memory for fault tolerance
        userCaches.set(socket.id, {
          telegramUserId: telegramUserId,
          coins: user.coins,
          energy: user.energy,
          max_energy: user.max_energy,
          energy_regen_rate: user.energy_regen_rate,
          last_energy_update: user.last_energy_update,
          lastSynced: Date.now(),
          pendingTaps: 0,
          pendingSave: false,
          avatarStats: avatarStats,
          readyForPvp: false,
        });

        // Remove user from matchmaking queue if they were there
        removeFromMatchmaking(telegramUserId);

        // Send initial state to client
        socket.emit("statusUpdated", {
          coins: user.coins,
          energy: user.energy,
          max_energy: user.max_energy,
        });

        // Background energy regeneration
        const interval = setInterval(() => {
          const userCache = userCaches.get(socket.id);
          if (!userCache || isTapping) return;

          try {
            // Update energy in the local cache
            const updated = regenerateEnergyInCache(userCache);

            if (updated) {
              // Only emit updates when energy actually changes
              socket.emit("energyUpdated", {
                energy: userCache.energy,
                max_energy: userCache.max_energy,
              });
              userCache.pendingSave = true;
            }
          } catch (err) {
            console.error(`[Socket] Error regenerating energy:`, err);
          }
        }, 1000);

        // Separate DB sync interval with exponential backoff on failure
        let backoffTime = 2000; // Start with 2s
        const maxBackoff = 30000; // Max 30s

        syncInterval = setInterval(async () => {
          try {
            await syncCacheToDatabase(socket.id);

            // Reset backoff on success
            backoffTime = 2000;
            dbOffline = false;
          } catch (err) {
            console.error(`[Socket] Error syncing to database:`, err);
            dbOffline = true;

            // Increase backoff time exponentially
            backoffTime = Math.min(backoffTime * 1.5, maxBackoff);
            console.log(
              `[Socket] Database sync failed, retrying in ${
                backoffTime / 1000
              }s`
            );

            // Adjust the interval
            if (syncInterval) {
              clearInterval(syncInterval);
              syncInterval = setInterval(async () => {
                try {
                  await syncCacheToDatabase(socket.id);

                  // Reset on success
                  backoffTime = 2000;
                  dbOffline = false;

                  // Reset the interval to normal
                  if (syncInterval) {
                    clearInterval(syncInterval);
                    syncInterval = setInterval(
                      () => syncCacheToDatabase(socket.id),
                      SYNC_INTERVAL
                    );
                  }
                } catch (err) {
                  console.error(`[Socket] Error syncing in backoff:`, err);
                }
              }, backoffTime);
            }
          }
        }, SYNC_INTERVAL);

        userIntervals.set(socket.id, interval);
      } catch (err) {
        console.error(`[Socket] Error initializing user:`, err);
        socket.emit("error", {
          message: "Error initializing user. Please try again.",
        });
      }
    });

    // 💥 Handle tapping logic - works even during DB outages
    socket.on("tap", () => {
      if (!telegramUserId) {
        return socket.emit("error", {
          message: "Not initialized. Please refresh.",
        });
      }

      const userCache = userCaches.get(socket.id);
      if (!userCache) {
        return socket.emit("error", {
          message: "Session expired. Please refresh.",
        });
      }

      // Prevent tapping during active processing
      if (isTapping) return;

      try {
        isTapping = true;

        // Always update energy before processing tap
        regenerateEnergyInCache(userCache);

        // Check if we have energy to tap
        if (userCache.energy <= 0) {
          socket.emit("error", {
            message: "No energy left. Please wait to recharge.",
          });
          isTapping = false;
          return;
        }

        // Process the tap in cache immediately
        userCache.coins += 1;
        userCache.energy -= 1;
        userCache.pendingTaps += 1;
        userCache.pendingSave = true;

        // Send immediate feedback to client
        socket.emit("statusUpdated", {
          coins: userCache.coins,
          energy: userCache.energy,
          max_energy: userCache.max_energy,
          pending: dbOffline ? userCache.pendingTaps : 0,
        });

        // Try to sync to DB if we've accumulated taps and DB is back online
        if (userCache.pendingTaps >= 5 && !dbOffline) {
          syncCacheToDatabase(socket.id).catch((err) => {
            console.error(`[Socket] Error syncing after tap:`, err);
          });
        }
      } catch (err) {
        console.error(`[Socket] Error processing tap:`, err);
        socket.emit("error", { message: "Error processing tap" });
      } finally {
        isTapping = false;
      }
    });

    // ⚔️ Battle Socket Events

    // Start a new battle
    socket.on("battleStart", async (data: BattleStartPayload) => {
      if (!telegramUserId) {
        return socket.emit("error", {
          message: "Not initialized. Please refresh.",
        });
      }

      if (dbOffline) {
        return socket.emit("error", {
          message: "Battles unavailable while database is offline.",
        });
      }

      if (isBattling) {
        return socket.emit("error", { message: "Already in a battle." });
      }

      try {
        const userCache = userCaches.get(socket.id);
        if (!userCache) {
          return socket.emit("error", {
            message: "Session expired. Please refresh.",
          });
        }

        // Check if energy is sufficient
        if (userCache.energy < data.energy_to_spend) {
          return socket.emit("error", {
            message: `Not enough energy for battle. Needed: ${data.energy_to_spend}, Available: ${userCache.energy}`,
          });
        }

        // If PvP battle is requested, add to matchmaking queue
        if (data.battle_type === "pvp") {
          isBattling = true;

          // Find user from database to get ID
          const user = (await User.findOne({
            telegram_user_id: telegramUserId,
          })) as IUserModel;
          if (!user) {
            isBattling = false;
            return socket.emit("error", { message: "User not found" });
          }

          // Add to matchmaking queue
          userCache.readyForPvp = true;

          // Add to matchmaking queue
          const matchmakingData: MatchmakingUser = {
            socketId: socket.id,
            telegram_user_id: telegramUserId,
            userId: (user._id as mongoose.Types.ObjectId).toString(),
            energy_to_spend: data.energy_to_spend,
            timestamp: Date.now(),
            userLevel: user.level || 1,
            avatarStats: {
              power: userCache.avatarStats?.power || 10,
              defense: userCache.avatarStats?.defense || 5,
              speed: userCache.avatarStats?.speed || 5,
              health: userCache.avatarStats?.health || 100,
            },
          };

          addToMatchmaking(matchmakingData);

          // Notify the user they are in matchmaking
          socket.emit("matchmakingStarted", {
            position: getQueuePosition(telegramUserId),
            queue_size: matchmakingQueue.length,
            message: "Looking for an opponent...",
            energy_to_spend: data.energy_to_spend,
          });

          // Start searching for an opponent
          processMatchForUser(io, telegramUserId);

          return;
        }

        // For PvE battles, continue with existing logic
        isBattling = true;

        // Start the battle using our service
        const battle = await BattleService.startBattle({
          telegram_user_id: telegramUserId,
          battle_type: data.battle_type,
          opponent_id: data.opponent_id,
          difficulty: data.difficulty,
          energy_to_spend: data.energy_to_spend,
        });

        // Update the user cache with new energy values from the battle
        if (userCache) {
          // Fetch the user to get the updated energy value after battle started
          const user = (await User.findOne({
            telegram_user_id: telegramUserId,
          })) as IUserModel | null;
          if (user) {
            userCache.energy = user.energy;
            userCache.last_energy_update = user.last_energy_update;
            if (battle._id) {
              userCache.activeBattleId = battle._id.toString();
            } else {
              throw new Error("Battle ID is missing");
            }
          }
        }

        // Emit battle started event with battle data
        socket.emit("battleStarted", {
          battle_id: battle._id,
          user_stats: battle.battle_data.user_stats,
          opponent_stats: battle.battle_data.opponent_stats,
          opponent: battle.opponent_npc,
          energy: userCache?.energy || 0,
          max_energy: userCache?.max_energy || 0,
        });
      } catch (err: any) {
        console.error(`[Socket] Error starting battle:`, err);
        socket.emit("error", {
          message: `Error starting battle: ${err.message}`,
        });
      } finally {
        // Only set isBattling to false for PvE battles
        // For PvP, it will be set to false after matchmaking is complete
        if (data.battle_type !== "pvp") {
          isBattling = false;
        }
      }
    });

    // Cancel matchmaking
    socket.on("cancelMatchmaking", () => {
      if (!telegramUserId) {
        return socket.emit("error", {
          message: "Not initialized. Please refresh.",
        });
      }

      const userCache = userCaches.get(socket.id);
      if (userCache) {
        userCache.readyForPvp = false;
      }

      // Remove from matchmaking queue
      removeFromMatchmaking(telegramUserId);

      // Reset battle state
      isBattling = false;

      socket.emit("matchmakingCancelled", { message: "Matchmaking cancelled" });
    });

    // Process a battle turn
    socket.on("battleTurn", async (data: BattleTurnPayload) => {
      if (!telegramUserId) {
        return socket.emit("error", {
          message: "Not initialized. Please refresh.",
        });
      }

      if (dbOffline) {
        return socket.emit("error", {
          message: "Battles unavailable while database is offline.",
        });
      }

      // Prevent concurrent battle actions, but add automatic timeout recovery
      if (isBattling) {
        // Check if the battle action is stuck (taking more than 5 seconds)
        const battleTimeout = setTimeout(() => {
          console.log(
            `[Socket] Battle action timed out for ${socket.id}, resetting state`
          );
          isBattling = false;
        }, 5000);

        return socket.emit("error", {
          message:
            "Processing previous battle action. Please wait a moment and try again.",
        });
      }

      try {
        isBattling = true;

        // Create a timeout to automatically release the battle lock after 10 seconds
        // This prevents the battle state from getting permanently stuck
        const lockTimeout = setTimeout(() => {
          console.log(
            `[Socket] Battle lock timeout for ${socket.id}, resetting state`
          );
          isBattling = false;
        }, 10000);

        // Make sure this is the user's battle
        const userCache = userCaches.get(socket.id);
        if (!userCache || userCache.activeBattleId !== data.battle_id) {
          clearTimeout(lockTimeout);
          isBattling = false;
          throw new Error("Invalid battle ID");
        }

        // Get the battle from database
        const battle = await BattleService.getBattleById(data.battle_id);

        // Check if it's a PvP battle
        const isPvP = battle.opponent_id ? true : false;

        if (isPvP) {
          // Get or create PvP battle state tracking
          let pvpState = activePvpBattles.get(data.battle_id);
          const currentTimestamp = Date.now();

          // IMPORTANT: Get MongoDB user ID for player identification
          const user = await User.findOne({ telegram_user_id: telegramUserId });
          if (!user) {
            throw new Error("User not found in database");
          }

          // Determine if this is player 1 or player 2
          if (!user || !(user instanceof User)) {
            throw new Error("User is not of type IUserModel");
          }
          if (!(user instanceof User)) {
            throw new Error("User is not of type IUserModel");
          }
          const isUser1 =
            (battle.user_id as mongoose.Types.ObjectId | string)?.toString() ===
            (user._id as mongoose.Types.ObjectId | string)?.toString();

          console.log(
            `[PvP Battle] Processing action for ${
              isUser1 ? "User1" : "User2"
            }, ActionType: ${data.action.type}, BattleID: ${data.battle_id}`
          );

          if (!pvpState) {
            // Initialize state for this battle
            pvpState = {
              battleId: data.battle_id,
              user1Id: battle.user_id.toString(),
              user2Id: battle.opponent_id?.toString() || "",
              user1Socket: isUser1 ? socket.id : "",
              user2Socket: isUser1 ? "" : socket.id,
              user1Attacked: isUser1,
              user2Attacked: !isUser1,
              user1AttackTime: isUser1 ? currentTimestamp : undefined,
              user2AttackTime: !isUser1 ? currentTimestamp : undefined,
            };
            activePvpBattles.set(data.battle_id, pvpState);

            console.log(
              `[PvP Battle] New battle state created: User1=${pvpState.user1Id}, User2=${pvpState.user2Id}, User1Attacked=${pvpState.user1Attacked}, User2Attacked=${pvpState.user2Attacked}`
            );
          } else {
            // Update existing state
            if (isUser1) {
              pvpState.user1Attacked = true;
              pvpState.user1AttackTime = currentTimestamp;
              pvpState.user1Socket = socket.id;
            } else {
              pvpState.user2Attacked = true;
              pvpState.user2AttackTime = currentTimestamp;
              pvpState.user2Socket = socket.id;
            }

            console.log(
              `[PvP Battle] Updated battle state: User1Attacked=${pvpState.user1Attacked}, User2Attacked=${pvpState.user2Attacked}`
            );
          }

          // Check if both players have submitted their actions
          if (pvpState.user1Attacked && pvpState.user2Attacked) {
            console.log(
              "[PvP Battle] Both players have attacked, processing battle"
            );

            // Both players attacked - determine who was faster
            if (pvpState.user1AttackTime && pvpState.user2AttackTime) {
              // Set the first_attacker in the battle document
              if (pvpState.user1AttackTime < pvpState.user2AttackTime) {
                battle.first_attacker = "user";
                console.log(
                  `[PvP Battle] User1 attacked first: ${pvpState.user1AttackTime} vs ${pvpState.user2AttackTime}`
                );
              } else {
                battle.first_attacker = "opponent";
                console.log(
                  `[PvP Battle] User2 attacked first: ${pvpState.user2AttackTime} vs ${pvpState.user1AttackTime}`
                );
              }
              await battle.save();
            }

            // Process the battle with the timing info
            const processedBattle = await BattleService.processPvpBattle(
              data.battle_id
            );

            // Send updates to both players
            const user1Socket = io.sockets.sockets.get(pvpState.user1Socket);
            const user2Socket = io.sockets.sockets.get(pvpState.user2Socket);

            if (processedBattle.status === "completed") {
              // Battle is over, send results
              if (user1Socket) {
                const user1Cache = userCaches.get(pvpState.user1Socket);
                if (user1Cache) {
                  // Update coins for user 1
                  user1Cache.coins +=
                    processedBattle.result === BattleResult.VICTORY
                      ? processedBattle.coins_earned
                      : Math.floor(processedBattle.coins_earned * 0.2);
                  user1Cache.pendingSave = true;
                  user1Cache.activeBattleId = undefined;

                  user1Socket.emit("battleCompleted", {
                    battle_id: processedBattle._id,
                    result: processedBattle.result,
                    coins_earned:
                      processedBattle.result === BattleResult.VICTORY
                        ? processedBattle.coins_earned
                        : Math.floor(processedBattle.coins_earned * 0.2),
                    experience_earned: processedBattle.experience_earned,
                    coins: user1Cache.coins,
                    battle_data: processedBattle.battle_data,
                    first_attacker: processedBattle.first_attacker,
                  });
                }
              }

              if (user2Socket) {
                const user2Cache = userCaches.get(pvpState.user2Socket);
                if (user2Cache) {
                  // Update coins for user 2 (opposite result)
                  user2Cache.coins +=
                    processedBattle.result === BattleResult.DEFEAT
                      ? processedBattle.coins_earned
                      : Math.floor(processedBattle.coins_earned * 0.2);
                  user2Cache.pendingSave = true;
                  user2Cache.activeBattleId = undefined;

                  user2Socket.emit("battleCompleted", {
                    battle_id: processedBattle._id,
                    // Invert result for player 2
                    result:
                      processedBattle.result === BattleResult.VICTORY
                        ? BattleResult.DEFEAT
                        : BattleResult.VICTORY,
                    coins_earned:
                      processedBattle.result === BattleResult.DEFEAT
                        ? processedBattle.coins_earned
                        : Math.floor(processedBattle.coins_earned * 0.2),
                    experience_earned: processedBattle.experience_earned,
                    coins: user2Cache.coins,
                    battle_data: {
                      ...processedBattle.battle_data,
                      // Swap stats for player 2's perspective
                      user_stats: processedBattle.battle_data.opponent_stats,
                      opponent_stats: processedBattle.battle_data.user_stats,
                    },
                    // Invert first attacker for player 2
                    first_attacker:
                      processedBattle.first_attacker === "user"
                        ? "opponent"
                        : "user",
                  });
                }
              }

              // Clean up
              activePvpBattles.delete(data.battle_id);
            } else {
              // Battle continues
              if (user1Socket) {
                user1Socket.emit("battleTurnProcessed", {
                  battle_id: processedBattle._id,
                  current_round:
                    processedBattle.battle_data.rounds[
                      processedBattle.battle_data.rounds.length - 1
                    ],
                  user_stats: processedBattle.battle_data.user_stats,
                  opponent_stats: processedBattle.battle_data.opponent_stats,
                  rounds_completed: processedBattle.battle_data.rounds.length,
                  first_attacker: processedBattle.first_attacker,
                });
              }

              if (user2Socket) {
                user2Socket.emit("battleTurnProcessed", {
                  battle_id: processedBattle._id,
                  current_round:
                    processedBattle.battle_data.rounds[
                      processedBattle.battle_data.rounds.length - 1
                    ],
                  // Swap stats for player 2's perspective
                  user_stats: processedBattle.battle_data.opponent_stats,
                  opponent_stats: processedBattle.battle_data.user_stats,
                  rounds_completed: processedBattle.battle_data.rounds.length,
                  // Invert first attacker for player 2
                  first_attacker:
                    processedBattle.first_attacker === "user"
                      ? "opponent"
                      : "user",
                });
              }
            }
          } else {
            // Wait for other player to submit action
            socket.emit("waitingForOpponent", {
              battle_id: data.battle_id,
              action_submitted: data.action.type,
            });
          }
        } else {
          // For PvE battles, continue with existing logic
          const processedBattle = await BattleService.processBattleTurn(
            data.battle_id,
            data.action
          );

          // Check if battle is completed
          if (processedBattle.status === "completed") {
            // Update user cache with rewards
            if (processedBattle.coins_earned > 0) {
              userCache.coins += processedBattle.coins_earned;
              userCache.pendingSave = true;
            }

            // Clear the active battle
            userCache.activeBattleId = undefined;

            // Emit battle completed event
            socket.emit("battleCompleted", {
              battle_id: processedBattle._id,
              result: processedBattle.result,
              coins_earned: processedBattle.coins_earned,
              experience_earned: processedBattle.experience_earned,
              coins: userCache.coins,
              battle_data: processedBattle.battle_data,
            });
          } else {
            // Battle continues, emit the updated battle state
            socket.emit("battleTurnProcessed", {
              battle_id: processedBattle._id,
              current_round:
                processedBattle.battle_data.rounds[
                  processedBattle.battle_data.rounds.length - 1
                ],
              user_stats: processedBattle.battle_data.user_stats,
              opponent_stats: processedBattle.battle_data.opponent_stats,
              rounds_completed: processedBattle.battle_data.rounds.length,
            });
          }
        }

        // Clear the timeout since we completed successfully
        clearTimeout(lockTimeout);
      } catch (err: any) {
        console.error(`[Socket] Error processing battle turn:`, err);
        socket.emit("error", {
          message: `Error processing battle turn: ${err.message}`,
        });
      } finally {
        // Always make sure to reset the battle state flag when done
        isBattling = false;
      }
    });

    // Auto-resolve a battle (quick battle)
    socket.on("battleAutoResolve", async (data: { battle_id: string }) => {
      if (!telegramUserId) {
        return socket.emit("error", {
          message: "Not initialized. Please refresh.",
        });
      }

      if (dbOffline) {
        return socket.emit("error", {
          message: "Battles unavailable while database is offline.",
        });
      }

      if (isBattling) {
        return socket.emit("error", {
          message: "Already processing a battle.",
        });
      }

      try {
        isBattling = true;

        // Make sure this is the user's battle
        const userCache = userCaches.get(socket.id);
        if (!userCache || userCache.activeBattleId !== data.battle_id) {
          throw new Error("Invalid battle ID");
        }

        // Auto-resolve the battle
        const battle = await BattleService.autoResolveBattle(data.battle_id);

        // Update user cache with rewards
        if (battle.coins_earned > 0) {
          userCache.coins += battle.coins_earned;
          userCache.pendingSave = true;
        }

        // Clear the active battle
        userCache.activeBattleId = undefined;

        // Emit battle completed event
        socket.emit("battleCompleted", {
          battle_id: battle._id,
          result: battle.result,
          coins_earned: battle.coins_earned,
          experience_earned: battle.experience_earned,
          coins: userCache.coins,
          battle_data: battle.battle_data,
        });
      } catch (err: any) {
        console.error(`[Socket] Error auto-resolving battle:`, err);
        socket.emit("error", {
          message: `Error auto-resolving battle: ${err.message}`,
        });
      } finally {
        isBattling = false;
      }
    });

    // ❌ Clean up when user disconnects
    socket.on("disconnect", async () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);

      // Remove from matchmaking if they were queued
      if (telegramUserId) {
        removeFromMatchmaking(telegramUserId);
      }

      // Final sync attempt before cleanup
      try {
        await syncCacheToDatabase(socket.id);
      } catch (err) {
        console.error(`[Socket] Error on final sync:`, err);
      }

      // Clear intervals and cache
      const interval = userIntervals.get(socket.id);
      if (interval) clearInterval(interval);

      if (syncInterval) clearInterval(syncInterval);

      userIntervals.delete(socket.id);
      userCaches.delete(socket.id);
    });

    // Sync cache to database when available
    async function syncCacheToDatabase(socketId: string): Promise<boolean> {
      const userCache = userCaches.get(socketId);
      if (!userCache || !userCache.pendingSave) return false;

      // Check DB connection
      if (mongoose.connection.readyState !== 1) {
        throw new Error("Database connection unavailable");
      }

      // Fetch latest user data and apply cached changes
      const user = await User.findOne({
        telegram_user_id: userCache.telegramUserId,
      });
      if (!user) throw new Error("User not found in database");

      // Apply pending taps
      if (userCache.pendingTaps > 0) {
        user.coins += userCache.pendingTaps;
        userCache.pendingTaps = 0;
      }

      // Update energy and last_energy_update
      user.energy = userCache.energy;
      user.last_energy_update = userCache.last_energy_update;

      // Save to database
      await user.save();

      // Update cache with latest synced time
      userCache.lastSynced = Date.now();
      userCache.pendingSave = false;

      return true;
    }
  });
};

// ⚡ Regenerate energy in the user cache
function regenerateEnergyInCache(userCache: UserCache): boolean {
  const now = Date.now();
  const lastUpdate = userCache.last_energy_update.getTime();
  const elapsed = now - lastUpdate;

  const regenRate = Math.max(
    0.1,
    Math.min(userCache.energy_regen_rate || 1, 10)
  );
  const msPerEnergy = 1000 / regenRate;

  const regenAmount = Math.floor(elapsed / msPerEnergy);

  if (regenAmount > 0 && userCache.energy < userCache.max_energy) {
    userCache.energy = Math.min(
      userCache.energy + regenAmount,
      userCache.max_energy
    );
    userCache.last_energy_update = new Date(now);
    userCache.pendingSave = true;
    return true;
  }

  return false;
}

// 🔍 Matchmaking functions
function addToMatchmaking(user: MatchmakingUser) {
  // Remove if already in queue
  removeFromMatchmaking(user.telegram_user_id);

  // Add to queue
  matchmakingQueue.push(user);
  console.log(
    `[Matchmaking] Added user ${user.telegram_user_id} to queue. Queue size: ${matchmakingQueue.length}`
  );
}

function removeFromMatchmaking(telegramUserId: string) {
  const index = matchmakingQueue.findIndex(
    (u) => u.telegram_user_id === telegramUserId
  );
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
    console.log(
      `[Matchmaking] Removed user ${telegramUserId} from queue. Queue size: ${matchmakingQueue.length}`
    );
  }
}

function getQueuePosition(telegramUserId: string): number {
  const index = matchmakingQueue.findIndex(
    (u) => u.telegram_user_id === telegramUserId
  );
  return index !== -1 ? index + 1 : 0;
}

async function processMatchmaking(io: Server) {
  // Nothing to match if less than 2 players
  if (matchmakingQueue.length < 2) return;

  // Sort by longest wait time (oldest first)
  matchmakingQueue.sort((a, b) => a.timestamp - b.timestamp);

  // Process each user in queue
  for (let i = 0; i < matchmakingQueue.length; i++) {
    const user = matchmakingQueue[i];
    await processMatchForUser(io, user.telegram_user_id);
  }
}

async function processMatchForUser(io: Server, telegramUserId: string) {
  // Find user in queue
  const userIndex = matchmakingQueue.findIndex(
    (u) => u.telegram_user_id === telegramUserId
  );
  if (userIndex === -1) return;

  const user = matchmakingQueue[userIndex];

  // Find potential opponents - EXACT level match for stricter matchmaking
  const potentialOpponents = matchmakingQueue.filter((opponent, index) => {
    // Skip self
    if (index === userIndex) return false;

    // Make sure energy to spend matches
    if (opponent.energy_to_spend !== user.energy_to_spend) return false;

    // Exact level-based matchmaking - only match with players of the same level
    if (opponent.userLevel !== user.userLevel) return false;

    return true;
  });

  if (potentialOpponents.length === 0) {
    // No potential opponents, update wait time
    const waitTimeSeconds = Math.floor((Date.now() - user.timestamp) / 1000);

    // Send waiting update every 5 seconds
    if (waitTimeSeconds % 5 === 0) {
      const userSocket = io.sockets.sockets.get(user.socketId);
      if (userSocket) {
        userSocket.emit("matchmakingUpdate", {
          position: getQueuePosition(user.telegram_user_id),
          queue_size: matchmakingQueue.length,
          wait_time: waitTimeSeconds,
          message: `Waiting for opponent at level ${user.userLevel}... (${waitTimeSeconds}s)`,
        });
      }
    }

    // Gradually expand matchmaking range after 30 seconds
    if (waitTimeSeconds > 30 && waitTimeSeconds % 10 === 0) {
      const userSocket = io.sockets.sockets.get(user.socketId);
      if (userSocket) {
        userSocket.emit("matchmakingUpdate", {
          position: getQueuePosition(user.telegram_user_id),
          queue_size: matchmakingQueue.length,
          wait_time: waitTimeSeconds,
          message: `Expanding matchmaking range... (${waitTimeSeconds}s)`,
        });
      }

      // After 30 seconds, we'll try again with slightly expanded level range (±1 level)
      const expandedPotentialOpponents = matchmakingQueue.filter(
        (opponent, index) => {
          // Skip self
          if (index === userIndex) return false;

          // Make sure energy to spend matches
          if (opponent.energy_to_spend !== user.energy_to_spend) return false;

          // Slightly expanded level-based matchmaking - players within +/- 1 level
          if (Math.abs(opponent.userLevel - user.userLevel) > 1) return false;

          return true;
        }
      );

      if (expandedPotentialOpponents.length > 0) {
        findBestMatchAndCreateBattle(io, user, expandedPotentialOpponents);
      }
    }

    return;
  }

  await findBestMatchAndCreateBattle(io, user, potentialOpponents);
}

// Helper function to find the best opponent match and create a battle
async function findBestMatchAndCreateBattle(
  io: Server,
  user: MatchmakingUser,
  potentialOpponents: MatchmakingUser[]
) {
  // Find best match based on stats
  let bestMatch = potentialOpponents[0];
  let closestStatDiff = Infinity;

  for (const opponent of potentialOpponents) {
    // Calculate stat difference to find closest match
    const statDiff =
      Math.abs(user.avatarStats.power - opponent.avatarStats.power) +
      Math.abs(user.avatarStats.defense - opponent.avatarStats.defense) +
      Math.abs(user.avatarStats.speed - opponent.avatarStats.speed) +
      Math.abs(user.avatarStats.health - opponent.avatarStats.health);

    if (statDiff < closestStatDiff) {
      closestStatDiff = statDiff;
      bestMatch = opponent;
    }
  }

  // Create PvP battle between the two users
  try {
    // Get socket instances
    const userSocket = io.sockets.sockets.get(user.socketId);
    const opponentSocket = io.sockets.sockets.get(bestMatch.socketId);

    if (!userSocket || !opponentSocket) {
      throw new Error("One of the players is no longer connected");
    }

    // Get user caches
    const userCache = userCaches.get(user.socketId);
    const opponentCache = userCaches.get(bestMatch.socketId);

    if (!userCache || !opponentCache) {
      throw new Error("User cache not found");
    }

    // Start the battle
    const battle = await BattleService.startPvpBattle({
      user1_id: user.userId,
      user2_id: bestMatch.userId,
      energy_to_spend: user.energy_to_spend,
    });

    // Remove both from matchmaking queue
    removeFromMatchmaking(user.telegram_user_id);
    removeFromMatchmaking(bestMatch.telegram_user_id);

    // Update user caches
    userCache.readyForPvp = false;
    opponentCache.readyForPvp = false;

    // Safely set battle ID in userCache
    if (battle._id) {
      // Convert any type of ID to a string
      userCache.activeBattleId = battle._id.toString();
      opponentCache.activeBattleId = battle._id.toString();
    } else {
      throw new Error("Battle ID is missing");
    }

    // Update energy in cache
    const user1 = await User.findById(user.userId);
    const user2 = await User.findById(bestMatch.userId);

    if (user1) {
      userCache.energy = user1.energy;
      userCache.last_energy_update = user1.last_energy_update;
    }

    if (user2) {
      opponentCache.energy = user2.energy;
      opponentCache.last_energy_update = user2.last_energy_update;
    }

    // Notify both users
    userSocket.emit("battleStarted", {
      battle_id: battle._id,
      is_pvp: true,
      user_stats: battle.battle_data.user_stats,
      opponent_stats: battle.battle_data.opponent_stats,
      opponent_name: user2?.username || "Opponent",
      opponent_level: user2?.level || 1,
      energy: userCache.energy,
      max_energy: userCache.max_energy,
    });

    opponentSocket.emit("battleStarted", {
      battle_id: battle._id,
      is_pvp: true,
      // Swap user and opponent stats for player 2
      user_stats: battle.battle_data.opponent_stats,
      opponent_stats: battle.battle_data.user_stats,
      opponent_name: user1?.username || "Opponent",
      opponent_level: user1?.level || 1,
      energy: opponentCache.energy,
      max_energy: opponentCache.max_energy,
    });

    console.log(
      `[Matchmaking] Created PvP battle between ${user.telegram_user_id} and ${bestMatch.telegram_user_id}`
    );
  } catch (err) {
    console.error(`[Matchmaking] Error creating PvP battle:`, err);

    // Notify users of failure
    const userSocket = io.sockets.sockets.get(user.socketId);
    const opponentSocket = io.sockets.sockets.get(bestMatch.socketId);

    if (userSocket) {
      userSocket.emit("error", {
        message: "Failed to create PvP battle. Please try again.",
      });
    }

    if (opponentSocket) {
      opponentSocket.emit("error", {
        message: "Failed to create PvP battle. Please try again.",
      });
    }

    // Remove both from matchmaking
    removeFromMatchmaking(user.telegram_user_id);
    removeFromMatchmaking(bestMatch.telegram_user_id);

    // Reset battle flags
    const userCache = userCaches.get(user.socketId);
    const opponentCache = userCaches.get(bestMatch.socketId);

    if (userCache) userCache.readyForPvp = false;
    if (opponentCache) opponentCache.readyForPvp = false;
  }
}
