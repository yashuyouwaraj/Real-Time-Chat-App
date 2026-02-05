import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { assertDatabaseConnection } from "./db/db.js";
import { logger } from "./lib/logger.js";
import http from "node:http"
import { initIo } from "./realtime/io.js";
import { initRedis, closeRedis } from "./config/redis.js";

async function bootstrap() {
    try {
        await assertDatabaseConnection()
        
        // Initialize Redis adapter if enabled
        await initRedis()
        
        const app = createApp()
        const server = http.createServer(app)
        
        const port = Number(env.PORT) || 5000

        await initIo(server)

        server.listen(port, '0.0.0.0', () => {
            logger.info(`Server is now listening to port: http://localhost:${port}`)
        })

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            logger.info("Shutting down gracefully...")
            await closeRedis()
            process.exit(0)
        })

    } catch (err) {
        logger.error(`Failed to start the server - ${(err as Error).message}`)
        process.exit(1)
    }
}

bootstrap()