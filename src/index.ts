import { TwitterServiceConfig, MentionEvent, Message, ThreadContext, RateLimitEvent, twitterWebhookSchema } from "./types";
import winston from "winston";
import express, { Express, Request, Response } from "express";
import { EventEmitter } from "events";
import { TwitterApi } from "twitter-api-v2";

/**
 * Service for handling Twitter interactions including webhooks and mentions
 */
export class TwitterService {
  private config: TwitterServiceConfig;
  private logger: winston.Logger;
  private app: Express;
  private emitter: EventEmitter;
  private twitterClient: TwitterApi;
  private threads: Map<string, ThreadContext>;

  public on: (event: string | symbol, listener: (...args: any[]) => void) => EventEmitter;
  public emit: (event: string | symbol, ...args: any[]) => boolean;

  /**
   * Creates a new instance of TwitterService
   * @param config - Configuration options for the service
   */
  constructor(config: TwitterServiceConfig) {
    this.config = {
      ...config,
      threadHistoryLimit: config.threadHistoryLimit ?? 50,
    };
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

  /**
   * Starts the Twitter service and webhook server
   */
  public async start() {
    try {
      this.app.use(express.json());
      this.app.post("/webhook", this.webhook.bind(this));

      const server = this.app.listen(this.config.webhookPort, () => {
        this.logger.info(`Server is running on port ${this.config.webhookPort}`);
      });

      server.on("error", (error) => {
        this.logger.error("Server error occurred", { error });
        this.emit("serverError", error);
      });

      this.logger.info("Twitter service started");
    } catch (error) {
      this.logger.error("Failed to start Twitter service", { error });
      throw error;
    }
  }

  /**
   * Handles incoming webhook requests
   */
  private async webhook(req: Request, res: Response) {
    try {
      res.status(200).send("OK");
      await this.handleMention(req.body);
    } catch (error) {
      this.logger.error("Error processing webhook", { error, body: req.body });
      // We've already sent 200 OK to Twitter, but we'll emit an error event
      this.emit("webhookError", { error, body: req.body });
    }
  }

  /**
   * Processes mention events from the webhook
   */
  private async handleMention(mention: unknown) {
    this.logger.info("Received webhook", mention);

    const result = twitterWebhookSchema.safeParse(mention);

    if (!result.success) {
      this.logger.warn("Invalid mention format", {
        mention,
        error: result.error.format(),
      });
      this.emit("invalidMention", { mention, error: result.error });
      return;
    }

    const tweet = result.data.tweet;
    if (!tweet) {
      this.logger.warn("No tweet data in mention", { mention });
      return;
    }

    this.logger.info("Valid mention", {
      text: tweet.text,
      id: tweet.id,
    });

    const mentionEvent: MentionEvent = {
      message: tweet.text,
      threadId: tweet.conversation_id,
      userId: tweet.author_id,
      tweetId: tweet.id,
    };

    // Add message to thread context
    this.addMessageToThread(mentionEvent.threadId, {
      senderId: mentionEvent.userId,
      timestamp: Date.now(),
      content: mentionEvent.message,
    });

    this.emit("newMention", mentionEvent);
  }

  /**
   * Replies to a tweet with the given message
   */
  private async replyToTweet(tweetId: string, message: string) {
    try {
      const response = await this.twitterClient.v2.reply(message, tweetId);
      this.logger.info("Successfully responded to tweet", {
        tweetId,
        message,
        response,
      });
      return response;
    } catch (error: any) {
      if (error?.rateLimitError) {
        const rateLimitEvent: RateLimitEvent = {
          tweetId,
          message,
          error,
        };
        this.logger.warn("Rate limited when attempting to respond to tweet", rateLimitEvent);
        this.emit("rateLimitWarning", rateLimitEvent);
      } else {
        this.logger.error("Failed to respond to tweet", {
          tweetId,
          message,
          error,
        });
        this.emit("tweetError", { tweetId, message, error });
      }
      throw error;
    }
  }

  /**
   * Gets the context for a thread, creating it if it doesn't exist
   */
  private getThreadContext(threadId: string): ThreadContext {
    if (this.threads.has(threadId)) {
      return this.threads.get(threadId)!;
    } else {
      const newThread = { threadId: threadId, history: [] };
      this.threads.set(threadId, newThread);
      return newThread;
    }
  }

  /**
   * Adds a message to a thread's history, respecting the history limit if set
   */
  private addMessageToThread(threadId: string, message: Message) {
    const threadContext = this.getThreadContext(threadId);
    threadContext.history.push(message);

    // Apply history limit if configured
    if (this.config.threadHistoryLimit && threadContext.history.length > this.config.threadHistoryLimit) {
      threadContext.history = threadContext.history.slice(-this.config.threadHistoryLimit);
    }
  }
} 