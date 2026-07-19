import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export async function setHeartbeat(projectId : string) {
   const key = `heartbeat:${projectId}`;

   await redis.set(key, "active" , "EX", 600)
}

export async function isAlive(projectId : string) {
    const key = `heartbeat:${projectId}`

    const exists = await redis.exists(key)

   return exists > 0
}

export default redis