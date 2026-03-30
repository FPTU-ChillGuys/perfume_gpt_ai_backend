/**
 * Mock factories cho tất cả services dùng trong test.
 * Mỗi factory trả về một object jest.fn() tương ứng với method thực.
 */

// ──────────── AIService ────────────
export const createMockAIService = () => ({
  textGenerateFromPrompt: jest.fn(),
  textGenerateFromMessages: jest.fn(),
  textGenerateStreamFromPrompt: jest.fn(),
  TextGenerateStreamFromMessages: jest.fn(),
});

// ──────────── ConversationService ────────────
export const createMockConversationService = () => ({
  addConversation: jest.fn(),
  updateMessageToConversation: jest.fn(),
  getConversationById: jest.fn(),
  isExistConversation: jest.fn(),
  getAllConversations: jest.fn(),
  getAllConversationsPaginated: jest.fn(),
});

// ──────────── UserLogService ────────────
export const createMockUserLogService = () => ({
  getUserLogsByUserId: jest.fn(),
  createUserLogIfNotExist: jest.fn(),
  addUserSearch: jest.fn(),
  addSearchLogToUserLog: jest.fn(),
  addSurveyQuesAnsDetailToUserLog: jest.fn(),
  saveUserLogSummary: jest.fn(),
  getUserLogSummariesByUserId: jest.fn(),
  getUserLogSummaryReportByUserId: jest.fn(),
  getReportAndPromptSummaryUserLogs: jest.fn(),
  getReportAndPromptSummaryAllUsersLogs: jest.fn(),
  getAllUserIdsFromLogs: jest.fn(),
  getFirstDateOfPeriod: jest.fn(),
  convertUserLogsToReport: jest.fn(),
  getCachedUserLogSummaryReportByUserId: jest.fn(),
  getCachedReportAndPromptSummaryUserLogs: jest.fn(),
  clearSummaryCache: jest.fn(),
});

// ──────────── OrderService ────────────
export const createMockOrderService = () => ({
  getAllOrders: jest.fn(),
  getOrderById: jest.fn(),
  getOrdersByUserId: jest.fn(),
  getOrderDetailsWithOrdersByUserId: jest.fn(),
  getOrderReportFromGetOrderDetailsWithOrdersByUserId: jest.fn(),
});

// ──────────── ReviewService ────────────
export const createMockReviewService = () => ({
  getAllReviews: jest.fn(),
  getReviewsByVariantId: jest.fn(),
  getReviewStatisticByVariantId: jest.fn(),
});

// ──────────── SurveyService ────────────
export const createMockQuizService = () => ({
  addSurveyQues: jest.fn(),
  updateAnswer: jest.fn(),
  getSurveyQuesById: jest.fn(),
  getSurveyQuesByIdList: jest.fn(),
  getAllSurveyQues: jest.fn(),
  addSurveyQuesAnws: jest.fn(),
  getAllQuizQuesAnws: jest.fn(),
  getQuizQuesAnwsById: jest.fn(),
  getSurveyQuesAnwsByUserId: jest.fn(),
  checkExistSurveyQuesAnwsByUserId: jest.fn(),
  mappingFromRequestToEntity: jest.fn(),
});

// ──────────── InventoryService ────────────
export const createMockInventoryService = () => ({
  getInventoryStock: jest.fn(),
  getBatch: jest.fn(),
  createReportFromBatchAndStock: jest.fn(),
  createBatchReport: jest.fn(),
  createStockReport: jest.fn(),
  createBatchAndStockReport: jest.fn(),
});

// ──────────── ProfileService ────────────
export const createMockProfileService = () => ({
  getOwnProfile: jest.fn(),
  createProfileReport: jest.fn(),
  createSystemPromptFromProfile: jest.fn(),
});

// ──────────── AdminInstructionService ────────────
export const createMockAdminInstructionService = () => ({
  getAllInstructions: jest.fn(),
  getInstructionById: jest.fn(),
  getInstructionsByType: jest.fn(),
  getCombinedPromptByType: jest.fn(),
  createInstruction: jest.fn(),
  updateInstruction: jest.fn(),
  deleteInstruction: jest.fn(),
  getSystemPromptForDomain: jest.fn(),
});

// ──────────── AIAcceptanceService ────────────
export const createMockAIAcceptanceService = () => ({
  updateAIAcceptanceStatusById: jest.fn(),
  createAIAcceptanceRecord: jest.fn(),
  getAIAcceptanceByUserId: jest.fn(),
  getAIAcceptanceRateByAcceptanceStatus: jest.fn(),
  getAIAcceptanceRateByAcceptanceStatusWithUserId: jest.fn(),
});

// ──────────── ProductService ────────────
export const createMockProductService = () => ({
  getAllProducts: jest.fn(),
  getProductsUsingSemanticSearch: jest.fn(),
});
