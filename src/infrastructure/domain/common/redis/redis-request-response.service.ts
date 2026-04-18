import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RedisRequestResponseService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisRequestResponseService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    this.publisher = new Redis({ host, port });
    this.subscriber = new Redis({ host, port });

    this.subscriber.on('error', (err) => {
      this.logger.error(`[RedisSub] Connection error: ${err.message}`);
    });
    this.publisher.on('error', (err) => {
      this.logger.error(`[RedisPub] Connection error: ${err.message}`);
    });
  }

  async onApplicationShutdown() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  /**
   * Sends a request to a Redis channel and waits for a response on a unique reply channel.
   * @param channel The channel to send the request to.
   * @param payload The payload to send.
   * @param timeoutMs Maximum time to wait for the response.
   */
  async sendRequest<T>(channel: string, payload: any, timeoutMs: number = 10000): Promise<T> {
    const correlationId = uuidv4();
    const replyChannel = `reply:${correlationId}`;

    return new Promise<T>(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.subscriber.unsubscribe(replyChannel).catch(() => {});
        reject(new Error(`Redis request timed out after ${timeoutMs}ms on channel ${channel}`));
      }, timeoutMs);

      const handleMessage = (chan: string, message: string) => {
        if (chan === replyChannel) {
          clearTimeout(timeout);
          this.subscriber.unsubscribe(replyChannel).catch(() => {});
          this.subscriber.off('message', handleMessage);

          try {
            const response = JSON.parse(message);
            resolve(response as T);
          } catch (err) {
            reject(new Error(`Failed to parse Redis response: ${err.message}`));
          }
        }
      };

      try {
        await this.subscriber.subscribe(replyChannel);
        this.subscriber.on('message', handleMessage);

        const requestPayload = JSON.stringify({
          ...payload,
          replyChannel,
        });

        await this.publisher.publish(channel, requestPayload);
        this.logger.log(`[RedisReq] Published request to ${channel}, waiting on ${replyChannel}`);
      } catch (err) {
        clearTimeout(timeout);
        this.subscriber.unsubscribe(replyChannel).catch(() => {});
        reject(err);
      }
    });
  }
}
