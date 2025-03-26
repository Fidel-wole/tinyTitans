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

async function connectDB() {
  try {
    if (!MONGODB_URI) {
      throw new Error("MongoDB URI is not provided or is undefined");
    }

    await mongoose.connect(MONGODB_URI);
    console.log("DB connected");
  } catch (err) {
    console.error("Error connecting to DB", err);
  }
}

export default connectDB;
