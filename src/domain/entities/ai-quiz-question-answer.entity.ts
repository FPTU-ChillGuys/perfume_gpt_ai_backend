import { Common } from './common/common.entities';

export class AIQuizQuestionAnswer extends Common {
  userId!: string;
  questionId!: string;
  answerId!: string;
  ai_result!: string;
}
