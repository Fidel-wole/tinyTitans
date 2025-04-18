import express from "express";
import helmet from "helmet";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

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
  connectionStateRecovery: {
    // Enable connection state recovery
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
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

// Add a health check endpoint to check DB connection
app.get("/health", async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      res.status(200).json({
        status: "ok",
        database: "connected",
        uptime: process.uptime(),
      });
    } else {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        uptime: process.uptime(),
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
});

// Server Start Logic
async function startServer() {
  try {
    // Connect to database with retry logic
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.warn("⚠️ Starting server without database connection. Some features may be limited.");
    }

    // Register all socket event handlers
    registerSocketHandlers(io);

    // Start the server regardless of DB connection status
    server.listen(PORT || process.env.PORT, () => {
      console.log(`🚀 Server started on port ${PORT || process.env.PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (!dbConnected) {
        console.log("⚠️ Running with limited functionality - DB connection failed");
      }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
  } catch (err) {
    console.error("❌ Error starting server", err);
    process.exit(1);
  }
}

function gracefulShutdown() {
  console.log("🛑 Shutting down gracefully...");
  
  // Close the HTTP server
  server.close(() => {
    console.log("✅ HTTP server closed");
    
    // Close database connection
    mongoose.connection.close().then(() => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    }).catch((err) => {
      console.error("❌ Error closing MongoDB connection", err);
      process.exit(1);
    });
    
    // Force exit after 5 seconds if connections don't close properly
    setTimeout(() => {
      console.error("⚠️ Could not close connections in time, forcing shutdown");
      process.exit(1);
    }, 5000);
  });
}

startServer();
