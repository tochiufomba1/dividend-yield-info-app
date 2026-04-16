import { createClient, RedisClientType } from "redis";
import config from "../config/config";

export async function createRedisClient() {
    const redisClient: RedisClientType = createClient({
        url: config.redisUrl,
    });

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Connected to Redis');
    });

    redisClient.on('reconnecting', () => {
        console.log('Reconnecting to Redis...');
    });

    await redisClient.connect();

    return redisClient
}