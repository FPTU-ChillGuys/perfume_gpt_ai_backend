import { QuizQuestion } from './quiz-question.entity';
import { Common } from './common/common.entities';

export class QuizAnswer extends Common {
  questionId!: string;
  answer!: string;
  question!: QuizQuestion;
}
