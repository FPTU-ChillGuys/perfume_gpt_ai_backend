import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RecommendationService } from 'src/infrastructure/domain/recommendation/recommandation.service';

const ORDER_CREATED_CHANNEL = 'order_created';

@Injectable()
export class RedisSubscriberService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private subscriber: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly recommendationService: RecommendationService
  ) {}

  // ─── Lifecycle Hooks ───────────────────────────────────────────────────────

  async onApplicationBootstrap(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    // Dedicated Redis client for subscribe (cannot share with regular commands)
    this.subscriber = new Redis({ host, port, lazyConnect: true });

    this.subscriber.on('error', (err) => {
      this.logger.error(`[RedisSubscriber] Connection error: ${err.message}`);
    });

    try {
      await this.subscriber.connect();
      await this.subscriber.subscribe(ORDER_CREATED_CHANNEL);
      this.logger.log(`[RedisSubscriber] Subscribed to channel: ${ORDER_CREATED_CHANNEL}`);

      this.subscriber.on('message', (channel: string, message: string) => {
        if (channel === ORDER_CREATED_CHANNEL) {
          this.handleOrderCreated(message);
        }
      });
    } catch (err) {
      // Redis failure must NEVER crash the app — log and continue
      this.logger.warn(`[RedisSubscriber] Could not connect to Redis. Subscriber disabled: ${err?.message}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe(ORDER_CREATED_CHANNEL);
        await this.subscriber.quit();
        this.logger.log('[RedisSubscriber] Disconnected from Redis.');
      }
    } catch (err) {
      this.logger.warn(`[RedisSubscriber] Error during shutdown: ${err?.message}`);
    }
  }

  // ─── Message Handlers ──────────────────────────────────────────────────────

  /**
   * Handles an incoming `order_created` message from Redis Pub/Sub.
   * Parses the payload and triggers the repurchase recommendation flow.
   * Fire-and-forget: does not block the Redis message loop.
   */
  private handleOrderCreated(message: string): void {
    try {
      const payload = JSON.parse(message) as { orderId?: string; userId?: string };
      const { orderId, userId } = payload;

      if (!orderId || !userId) {
        this.logger.warn(`[RedisSubscriber][ORDER_CREATED] Invalid payload: ${message}`);
        return;
      }

      this.logger.log(`[RedisSubscriber][ORDER_CREATED] userId=${userId} orderId=${orderId}`);

      // Fire-and-forget so the Redis message loop is never blocked
      this.recommendationService.sendRepurchase(userId, orderId).catch((err) => {
        this.logger.error(
          `[RedisSubscriber][ORDER_CREATED] sendRepurchase failed userId=${userId} orderId=${orderId}: ${err?.message}`
        );
      });
    } catch (err) {
      this.logger.error(`[RedisSubscriber][ORDER_CREATED] Failed to parse message: ${message}`, err);
    }
  }
}

