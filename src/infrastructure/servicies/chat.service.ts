import { UnitOfWork } from '@mikro-orm/core';

export class ChatService {
  constructor(private unitOfWork: UnitOfWork) {}

  async savePrompt() {}
}
