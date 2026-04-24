import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, StringCodec } from 'nats';

@Injectable()
export class NatsRpcService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NatsRpcService.name);
  private nc: NatsConnection;
  private readonly sc = StringCodec();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('NATS_URL', 'nats://127.0.0.1:4222');
    try {
      this.nc = await connect({ servers: url });
      this.logger.log(`[NATS] Connected to ${url}`);
    } catch (err) {
      this.logger.error(`[NATS] Failed to connect: ${err.message}`);
    }
  }

  async onApplicationShutdown() {
    if (this.nc) {
      await this.nc.drain();
    }
  }

  /**
   * Sends a request to a NATS channel and waits for a response.
   * @param channel The NATS subject to send the request to.
   * @param action The specific action within the domain.
   * @param payload The relevant data for the action.
   * @param timeoutMs Maximum time to wait for the response.
   */
  async sendRequest<T>(channel: string, action: string, payload: any, timeoutMs: number = 15000): Promise<T> {
    if (!this.nc) {
      throw new Error(`NATS connection is not established.`);
    }

    const requestPayload = JSON.stringify({
      action,
      payload,
    });

    try {
      this.logger.log(`[NATS Req] Publishing ${action} to ${channel}`);
      const msg = await this.nc.request(channel, this.sc.encode(requestPayload), { timeout: timeoutMs });
      const responseString = this.sc.decode(msg.data);
      return JSON.parse(responseString) as T;
    } catch (err) {
      this.logger.error(`[NATS Req Error] Error sending request ${action} to ${channel}: ${err.message}`);
      throw err;
    }
  }
}
