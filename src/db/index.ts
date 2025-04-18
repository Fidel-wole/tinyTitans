import mongoose from "mongoose";
import {
  MONGO_DB_URL_DEV,
  MONGO_DB_URL_PROD,
  MONGO_DB_URL_STAGING,
  NODE_ENV,
} from "../config/env";

import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  NODE_ENV === "production"
    ? MONGO_DB_URL_PROD
    : NODE_ENV === "staging"
      ? MONGO_DB_URL_STAGING
      : MONGO_DB_URL_DEV;

// Connection retry mechanism
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000; // 5 seconds

async function connectDB(retryCount = 0): Promise<boolean> {
  try {
    if (!MONGODB_URI) {
      throw new Error("MongoDB URI is not provided or is undefined");
    }

    // Configure connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 30000, // Timeout after 30 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 2
    };

    await mongoose.connect(MONGODB_URI, options);
    console.log("✅ DB connected successfully");
    return true;
  } catch (err) {
    // Log with specific error details
    console.error(`❌ MongoDB connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err);
    
    // Handle common connection errors
    if (err instanceof Error) {
      if (
        err.message.includes('getaddrinfo EAI_AGAIN') || 
        err.message.includes('MongoServerSelectionError')
      ) {
        console.log(`⚠️ DNS resolution or network issue. Retrying in ${RETRY_INTERVAL_MS/1000} seconds...`);
      }
    }
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying connection in ${RETRY_INTERVAL_MS/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
      return connectDB(retryCount + 1);
    } else {
      console.error(`❌ Failed to connect to MongoDB after ${MAX_RETRIES} attempts`);
      return false;
    }
  }
}

export default connectDB;
