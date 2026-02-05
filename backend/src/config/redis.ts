import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";

let redisClient: RedisClientType | null = null;

export async function initRedis(): Promise<RedisClientType | null> {
  if (!env.ENABLE_REDIS_ADAPTER || env.ENABLE_REDIS_ADAPTER === "false") {
    console.log("[Redis] Disabled - using in-memory socket.io adapter");
    return null;
  }

  try {
    const client = createClient({
      socket: {
        host: env.REDIS_HOST,
        port: Number(env.REDIS_PORT),
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error("[Redis] Max reconnection attempts reached");
            return new Error("Max Redis connection attempts reached");
          }
          return Math.min(retries * 50, 500);
        },
      },
      ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
    }) as any;

    client.on("error", (err: Error) => {
      console.error("[Redis Error]", err.message);
    });

    client.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });

    client.on("ready", () => {
      console.log("[Redis] Ready to use");
    });

    client.on("reconnecting", () => {
      console.log("[Redis] Reconnecting...");
    });

    await client.connect();
    redisClient = client as any;
    return client as any;
  } catch (error) {
    console.error("[Redis Connection Error]", error);
    console.log("[Redis] Falling back to in-memory adapter");
    return null;
  }
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.disconnect();
      console.log("[Redis] Disconnected");
      redisClient = null;
    } catch (error) {
      console.error("[Redis Disconnect Error]", error);
    }
  }
}

export function isRedisEnabled(): boolean {
  return redisClient !== null;
}
