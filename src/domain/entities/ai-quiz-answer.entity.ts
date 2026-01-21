import { AIQuizQuestion } from './ai-quiz-question.entity';
import { Common } from './common/common.entities';

export class AIQuizAnswer extends Common {
  questionId!: string;
  answer!: string;
  question!: AIQuizQuestion;
}
