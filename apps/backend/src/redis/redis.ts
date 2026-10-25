import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if(!redisUrl) {
    throw new Error("REDIS_URL is required")
}

export const redis = new Redis(redisUrl , {
    maxRetriesPerRequest : 3,
    lazyConnect : true,
})


redis.on("error", (err) => {
    console.error("redis error", err)
})

export async function connectRedis() {
    if(redis.status === "wait") {
        await redis.connect();
    }
}