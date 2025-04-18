import { Server, Socket } from "socket.io";
import User from "../model/user";

interface TapPayload {
  telegram_userId: string;
}

export const registerSocketHandlers = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on("tap", async (data: TapPayload) => {
      const { telegram_user_id } = data;

      if (!telegram_user_id) {
        return socket.emit("error", { message: "Invalid payload" });
      }

      try {
        const user = await User.findOne({ telegram_user_id });

        if (!user) {
          return socket.emit("error", { message: "User not found" });
        }

        // TODO: Add rate-limiting logic here (Redis, memory, etc.)

        user.coins += 1;
        await user.save();

        socket.emit("coinsUpdated", { coins: user.coins });
      } catch (err) {
        console.error(`[Socket] Error on 'tap':`, err);
        socket.emit("error", { message: "Internal server error" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
    });
  });
};
