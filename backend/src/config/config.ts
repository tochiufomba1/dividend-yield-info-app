import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  redisUrl: string;
  alphaVantageAPIKey: string;
  nodeEnv: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  alphaVantageAPIKey: process.env.ALPHA_VANTAGE_API_KEY || "",
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;