import express from "express";
import helmet from "helmet";
import http from "http";
import { Server } from "socket.io";

import dispatcher from "./utils/dispatcher";
import appConfig from "./config/app";
import v1Router from "./routers";
import { PORT } from "./config/env";
import connectDB from "./db";
import { corsConfig } from "./config/cors";
import { registerSocketHandlers } from "./service/socket"; // import your socket logic

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: "*", // Set this to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(helmet());
app.use(express.json());
app.use(corsConfig);

// API Routes
app.use(appConfig.apiV1URL, v1Router);

// Root Route
app.get("/", (req, res) => {
  const message = "Welcome to Tiny Titans Backend Service";
  res.send(message);
  dispatcher.DispatchSuccessMessage(res, message);
});

// Server Start Logic
async function startServer() {
  try {
    await connectDB();

    // Register all socket event handlers
    registerSocketHandlers(io);

    server.listen(PORT || process.env.PORT, () => {
      console.log(`Server started on port ${PORT || process.env.PORT}`);
    });
  } catch (err) {
    console.error("❌ Error starting server", err);
  }
}

startServer();
