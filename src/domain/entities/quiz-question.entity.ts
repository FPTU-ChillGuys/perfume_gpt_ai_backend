import { Collection } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';

export class QuizQuestion extends Common {
  question!: string;
  answers = new Collection<QuizAnswer>(this);
}
