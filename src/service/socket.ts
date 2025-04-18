import { Server, Socket } from "socket.io";
import User from "../model/user";

interface TapPayload {
  telegram_user_id: string;
}

const userIntervals = new Map<string, NodeJS.Timeout>();

export const registerSocketHandlers = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    let telegramUserId: string | null = null;
    let isTapping: boolean = false;

    // 🟢 Start background energy regen when user initializes
    socket.on("initUser", async (data: TapPayload) => {
      telegramUserId = data.telegram_user_id;

      if (!telegramUserId) {
        return socket.emit("error", { message: "Invalid user ID" });
      }

      const user = await User.findOne({ telegram_user_id: telegramUserId });
      if (!user) {
        return socket.emit("error", { message: "User not found" });
      }

      // Start regenerating energy every second if no tapping is ongoing
      const interval = setInterval(async () => {
        if (isTapping) return; // Skip regen if tapping is ongoing

        try {
          const freshUser = await User.findOne({ telegram_user_id: telegramUserId });
          if (!freshUser) return;

          const updated = regenerateEnergy(freshUser);
          if (updated) {
            await freshUser.save();
            socket.emit("energyUpdated", {
              energy: freshUser.energy,
              max_energy: freshUser.max_energy,
            });
          }
        } catch (err) {
          console.error(`[Socket] Error regenerating energy:`, err);
        }
      }, 1000);

      userIntervals.set(socket.id, interval);
    });

    // 💥 Handle tapping logic
    socket.on("tap", async (data: TapPayload) => {
      const { telegram_user_id } = data;

      if (!telegram_user_id) {
        return socket.emit("error", { message: "Invalid payload" });
      }

      try {
        const user = await User.findOne({ telegram_user_id });
        if (!user) return socket.emit("error", { message: "User not found" });

        // Mark that tapping is happening
        isTapping = true;

        // Regenerate energy before tap
        regenerateEnergy(user);

        if (user.energy <= 0) {
          isTapping = false; // Reset tapping flag
          return socket.emit("error", { message: "No energy left. Please wait to recharge." });
        }

        user.coins += 1;
        user.energy -= 1;
        await user.save();

        socket.emit("statusUpdated", {
          coins: user.coins,
          energy: user.energy,
          max_energy: user.max_energy,
        });

        // After tap, allow regen to resume
        isTapping = false;

      } catch (err) {
        console.error(`[Socket] Error on 'tap':`, err);
        socket.emit("error", { message: "Internal server error" });
        isTapping = false; // Reset tapping flag on error
      }
    });

    // ❌ Clean up when user disconnects
    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
      const interval = userIntervals.get(socket.id);
      if (interval) clearInterval(interval);
      userIntervals.delete(socket.id);
    });
  });
};

// ⚡ Regenerate energy based on time elapsed and regen rate
function regenerateEnergy(user: any): boolean {
  const now = Date.now();
  const lastUpdate = user.last_energy_update?.getTime() || now;
  const elapsed = now - lastUpdate;

  const regenRate = Math.max(0.1, Math.min(user.energy_regen_rate || 1, 10));
  const msPerEnergy = 1000 / regenRate;

  const regenAmount = Math.floor(elapsed / msPerEnergy);

  if (regenAmount > 0 && user.energy < user.max_energy) {
    user.energy = Math.min(user.energy + regenAmount, user.max_energy);
    user.last_energy_update = new Date(now);
    return true;
  }

  return false;
}
