import { QuizAnswer } from './quiz-answer.entity';
import { QuizQuestion } from './quiz-question.entity';
import { Common } from './common/common.entities';
import { Entity } from '@mikro-orm/core';
import { QuizQuestionAnswerRepository } from 'src/infrastructure/repositories/quiz-question-answer.repository';

@Entity({ repository: () => QuizQuestionAnswerRepository })
export class QuizQuestionAnswer extends Common {
  userId!: string;
  questionId!: string;
  answerId!: string;
  ai_result!: string;
  question!: QuizQuestion;
  anwser!: QuizAnswer;
}
