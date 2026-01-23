import { Collection, Entity } from '@mikro-orm/core';
import { Common } from './common/common.entities';
import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestionRepository } from 'src/infrastructure/repositories/quiz-question.repository';

@Entity({ repository: () => QuizQuestionRepository })
export class QuizQuestion extends Common {
  question!: string;
  answers = new Collection<QuizAnswer>(this);
}
