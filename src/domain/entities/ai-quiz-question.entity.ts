import { Collection } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { AIQuizAnswer } from './ai-quiz-answer.entity';

export class AIQuizQuestion extends Common {
  question!: string;
  answers = new Collection<AIQuizAnswer>(this);
}
