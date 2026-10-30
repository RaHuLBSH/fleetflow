import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { logisticsRouter } from "./modules/logistics/logistics.routes.js";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      // The Vite frontend is served from a different origin than this API.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "FleetFlow API is running",
    });
  });
  app.use("/api/auth", authRouter);
  app.use("/api", logisticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
