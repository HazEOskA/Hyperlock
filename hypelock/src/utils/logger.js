// utils/logger.js — Structured logger for HYPELOCK
import winston from 'winston';

const { combine, timestamp, colorize, printf, json } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    isProd ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10_485_760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10_485_760,
      maxFiles: 10,
    }),
  ],
});

// Module-scoped child loggers for clean separation
export const filterLog   = logger.child({ module: 'AlphaFilter' });
export const scorerLog   = logger.child({ module: 'AdaptiveScorer' });
export const learningLog = logger.child({ module: 'LearningLoop' });
export const execLog     = logger.child({ module: 'Execution' });
export const distLog     = logger.child({ module: 'Distribution' });
export const signalLog   = logger.child({ module: 'SignalEngine' });
