import { TwitterServiceConfig, MentionEvent, Message, ThreadContext } from "./types";
import winston from "winston";
import express, { Express, Request, Response } from "express";
import { EventEmitter } from "events";
import { TwitterApi } from "twitter-api-v2";

export class TwitterService {
  private config: TwitterServiceConfig;
  private logger: winston.Logger;
  private app: Express;
  private emitter: EventEmitter;
  private twitterClient: TwitterApi;
  private threads: Map<string, ThreadContext>;

  public on: (event: string | symbol, listener: (...args: any[]) => void) => EventEmitter;
  public emit: (event: string | symbol, ...args: any[]) => boolean;

  constructor(config: TwitterServiceConfig) {
    this.config = config;
    this.threads = new Map();
    this.emitter = new EventEmitter();
    this.app = express();

    // Bind event emitter methods
    this.on = this.emitter.on.bind(this.emitter);
    this.emit = this.emitter.emit.bind(this.emitter);

    // Initialize logger with timestamp
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ""
          }`;
        })
      ),
      transports: [new winston.transports.Console()],
    });

    // Initialize Twitter client
    this.twitterClient = config.bearerToken
      ? new TwitterApi(config.bearerToken)
      : new TwitterApi({
          appKey: config.apiKey,
          appSecret: config.apiSecret,
        });
  }

  public async start() {
    this.app.use(express.json());
    this.app.post("/webhook", this.webhook.bind(this));

    this.app.listen(this.config.webhookPort, () => {
      this.logger.info(`Server is running on port ${this.config.webhookPort}`);
    });

    this.logger.info("Twitter service started");
  }

  private async webhook(req: Request, res: Response) {
    res.status(200).send("OK");
    this.handleMention(req.body);
  }

  private async handleMention(mention: any) {
    this.logger.info("received webhook", mention);

    if (mention?.tweet?.text) {
      this.logger.info("Valid Mention", {
        text: mention.tweet.text,
        id: mention.tweet.id,
      });

      const mentionEvent: MentionEvent = {
        message: mention.tweet.text,
        threadId: mention.tweet.conversation_id,
        userId: mention.tweet.author_id,
        tweetId: mention.tweet.id,
      };

      // Add message to thread context
      this.addMessageToThread(mentionEvent.threadId, {
        senderId: mentionEvent.userId,
        timestamp: Date.now(),
        content: mentionEvent.message,
      });

      this.emit("newMention", mentionEvent);
    } else {
      this.logger.warn("Invalid Mention", mention);
    }
  }

  private async replyToTweet(tweetId: string, message: string) {
    try {
      const response = await this.twitterClient.v2.reply(message, tweetId);
      this.logger.info("Successfully responded to tweet", {
        tweetId,
        message,
        response,
      });
    } catch (error: any) {
      if (error?.rateLimitError) {
        this.logger.warn("Rate limited when attempting to respond to tweet", {
          tweetId,
          message,
          error,
        });
      } else {
        this.logger.error("Failed to respond to tweet", {
          tweetId,
          message,
          error,
        });
      }
    }
  }

  private getThreadContext(threadId: string): ThreadContext {
    if (this.threads.has(threadId)) {
      return this.threads.get(threadId)!;
    } else {
      const newThread = { threadId: threadId, history: [] };
      this.threads.set(threadId, newThread);
      return newThread;
    }
  }

  private addMessageToThread(threadId: string, message: Message) {
    const threadContext = this.getThreadContext(threadId);
    threadContext.history.push(message);
  }
} 