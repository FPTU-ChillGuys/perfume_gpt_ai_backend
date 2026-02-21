export enum QueueName {
  CONVERSATION_QUEUE = 'conversation_queue',
  TREND_QUEUE = 'trend_queue',
  REVIEW_QUEUE = 'review_queue',
  RECOMMENDATION_QUEUE = 'recommendation_queue',
  INVENTORY_QUEUE = 'inventory_queue',
  ORDER_QUEUE = 'order_queue',
  AI_ACCEPTANCE_QUEUE = 'ai_acceptance_queue',
  ADMIN_INSTRUCTION_QUEUE = 'admin_instruction_queue',
  QUIZ_QUEUE = 'quiz_queue',
}

export enum ConversationJobName {
   ADD_MESSAGE_AND_LOG = 'add_message_and_log',
}

export enum QuizJobName {
     ADD_QUIZ_QUESTION_AND_ANSWER = 'add_quiz_question_and_answer',
}
