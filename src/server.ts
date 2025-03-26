import dispatcher from "./utils/dispatcher";
import appConfig from "./config/app";
import v1Router from "./routers";
import express from "express";
import helmet from "helmet";
import { PORT } from "./config/env";
import connectDB from "./db";
import { corsConfig } from "./config/cors";
const app = express();
app.use(helmet());
app.use(express.json());

app.use(corsConfig);

app.use(appConfig.apiV1URL, v1Router);

app.get("/", (req, res) => {
  const message = "Welcome to Tranzt Backend Service";
  res.send(message);
  dispatcher.DispatchSuccessMessage(res, message);
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT || process.env.PORT, () => {
      console.log(`Server started on port ${PORT || process.env.PORT}`);
    });
  } catch (err) {
    console.error("Error starting server", err);
  }
}
startServer();
