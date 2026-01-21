import { AIQuizAnswer } from './ai-quiz-answer.entity';
import { AIQuizQuestion } from './ai-quiz-question.entity';
import { Common } from './common/common.entities';

export class AIQuizQuestionAnswer extends Common {
  userId!: string;
  questionId!: string;
  answerId!: string;
  ai_result!: string;
  question!: AIQuizQuestion;
  anwser!: AIQuizAnswer;
}
