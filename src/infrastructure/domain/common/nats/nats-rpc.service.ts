import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, StringCodec } from 'nats';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class NatsRpcService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NatsRpcService.name);
  private nc: NatsConnection;
  private readonly sc = StringCodec();

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService
  ) {}

  async onModuleInit() {
    const url = this.configService.get<string>('NATS_URL', 'nats://127.0.0.1:4222');
    try {
      this.nc = await connect({ servers: url });
      this.logger.log(this.i18n.t('common.nats.connected', { args: { url } }));
    } catch (err) {
      this.logger.error(this.i18n.t('common.nats.connection_failed', { args: { error: err.message } }));
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
      throw new Error(this.i18n.t('common.nats.connection_not_established'));
    }

    const requestPayload = JSON.stringify({
      action,
      payload,
    });

    try {
      this.logger.log(this.i18n.t('common.nats.publishing', { args: { action, channel } }));
      const msg = await this.nc.request(channel, this.sc.encode(requestPayload), { timeout: timeoutMs });
      const responseString = this.sc.decode(msg.data);
      return JSON.parse(responseString) as T;
    } catch (err) {
      this.logger.error(this.i18n.t('common.nats.request_error', { args: { action, channel, error: err.message } }));
      throw err;
    }
  }
}
