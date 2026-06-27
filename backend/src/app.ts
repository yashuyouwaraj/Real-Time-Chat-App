import  express  from "express"
import cors from "cors"
import helmet from "helmet"
import { notFoundHandler } from "./middleware/notFoundHandler.js"
import { errorHandler } from "./middleware/errorHandler.js"
import {clerkMiddleware} from "./config/clerk.js"
import { corsOriginDelegate } from "./config/cors.js"
import { apiRouter } from "./routes/index.js"

export function createApp(){
    const app = express()

    app.use(helmet())
    app.use(cors({
    origin: corsOriginDelegate,
    credentials: true
}))

    app.use(clerkMiddleware())

    app.use(express.json())

    app.get("/", (_req, res) => {
        res.json({ status: "ok", service: "realtime-chat-api" });
    });

    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });

    app.use("/api",apiRouter)

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app
}