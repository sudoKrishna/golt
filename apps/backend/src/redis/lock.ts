import {redis} from "./redis";
import {randomUUID} from "crypto";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export async function acquireLock(key : string, ttlMs = DEFAULT_TTL_MS

) : Promise<(() => Promise<void>) | null> {
    const token = randomUUID();
    const result = await redis.set(key, token , "PX", ttlMs, "NX");

    if(result !== "OK") {
        return null;
    }

    const release  = async () => {
        const script = `if redis.call("get" , KEY[1]) === ARG[1] then return 
        redis.call("del", KEY[1])
        else
            return 0
        end
        `;
        await redis.eval(script, 1, key, token);
    }
    return release
    
}

export async function withLock<T>(key :string, fn: () => Promise<T>,
ttlMs = DEFAULT_TTL_MS): Promise<T | null> {
 const release = await acquireLock(key , ttlMs);
 if(!release) return null;
 
 try {
    return await fn();
 } finally {
    await release();
 }
}