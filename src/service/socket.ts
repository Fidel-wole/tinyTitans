import { Server, Socket } from "socket.io";
import User, { IUserModel } from "../model/user";
import mongoose from "mongoose";

interface TapPayload {
  telegram_user_id: string;
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
}

const userIntervals = new Map<string, NodeJS.Timeout>();
const userCaches = new Map<string, UserCache>(); // In-memory cache for users
const BATCH_PROCESS_INTERVAL = 50; // Process batches every 50ms for more responsive feel
const SYNC_INTERVAL = 2000; // Sync to DB every 2 seconds to reduce DB load

export const registerSocketHandlers = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    let telegramUserId: string | null = null;
    let isTapping: boolean = false;
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
            message: "Database is currently offline. Some features may be limited." 
          });
        }

        const user = await User.findOne({ telegram_user_id: telegramUserId });
        if (!user) {
          return socket.emit("error", { message: "User not found" });
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
          pendingSave: false
        });

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
            console.log(`[Socket] Database sync failed, retrying in ${backoffTime/1000}s`);
            
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
                    syncInterval = setInterval(() => syncCacheToDatabase(socket.id), SYNC_INTERVAL);
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
        socket.emit("error", { message: "Error initializing user. Please try again." });
      }
    });

    // 💥 Handle tapping logic - works even during DB outages
    socket.on("tap", () => {
      if (!telegramUserId) {
        return socket.emit("error", { message: "Not initialized. Please refresh." });
      }

      const userCache = userCaches.get(socket.id);
      if (!userCache) {
        return socket.emit("error", { message: "Session expired. Please refresh." });
      }

      // Prevent tapping during active processing
      if (isTapping) return;
      
      try {
        isTapping = true;
        
        // Always update energy before processing tap
        regenerateEnergyInCache(userCache);
        
        // Check if we have energy to tap
        if (userCache.energy <= 0) {
          socket.emit("error", { message: "No energy left. Please wait to recharge." });
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
          pending: dbOffline ? userCache.pendingTaps : 0
        });
        
        // Try to sync to DB if we've accumulated taps and DB is back online
        if (userCache.pendingTaps >= 5 && !dbOffline) {
          syncCacheToDatabase(socket.id).catch(err => {
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

    // ❌ Clean up when user disconnects
    socket.on("disconnect", async () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
      
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
      const user = await User.findOne({ telegram_user_id: userCache.telegramUserId });
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

  const regenRate = Math.max(0.1, Math.min(userCache.energy_regen_rate || 1, 10));
  const msPerEnergy = 1000 / regenRate;

  const regenAmount = Math.floor(elapsed / msPerEnergy);

  if (regenAmount > 0 && userCache.energy < userCache.max_energy) {
    userCache.energy = Math.min(userCache.energy + regenAmount, userCache.max_energy);
    userCache.last_energy_update = new Date(now);
    userCache.pendingSave = true;
    return true;
  }

  return false;
}
