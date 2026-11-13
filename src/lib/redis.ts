import {Redis} from "ioredis";

const {REDIS_URL}= process.env;

if(!REDIS_URL)
{
    throw new Error("REDIS_URL is not set in envrionment variables")
}

export const redisConnection= new Redis(REDIS_URL,{
    maxRetriesPerRequest: null,
})

redisConnection.on("error", (err)=> {
    console.error("[redis]", err.message)
})