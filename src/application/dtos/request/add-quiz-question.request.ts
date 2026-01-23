import { QuizAnswerRequest } from './add-quiz-answer.request';

export class QuizQuestionRequest {
  question!: string;
  answers!: QuizAnswerRequest[];
}
