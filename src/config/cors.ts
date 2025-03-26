import cors from "cors";
import { CORS_URLS } from "./env";

export const corsConfig = cors({
  origin: CORS_URLS?.split(",") ?? "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
});
