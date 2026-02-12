/**
 * Hằng số dùng chung trong các test case.
 */

/** ID mẫu dùng cho test */
export const TEST_USER_ID = 'user-test-001';
export const TEST_CONVERSATION_ID = 'conv-test-001';
export const TEST_VARIANT_ID = 'variant-test-001';
export const TEST_ORDER_ID = 'order-test-001';
export const TEST_INSTRUCTION_ID = 'instr-test-001';
export const TEST_QUIZ_QUESTION_ID = 'quiz-q-001';
export const TEST_ACCEPTANCE_ID = 'accept-001';

/** Token JWT giả */
export const TEST_AUTH_HEADER = 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test';

/** BaseResponse helper */
export function successResponse<T>(data: T) {
  return { success: true, data };
}

export function errorResponse(error: string) {
  return { success: false, error };
}

/** BaseResponseAPI helper */
export function successResponseAPI<T>(payload: T) {
  return { success: true, payload };
}

export function errorResponseAPI(error: string) {
  return { success: false, error };
}

/** Mock Express Request */
export function createMockRequest(overrides: Record<string, any> = {}): any {
  return {
    headers: { authorization: TEST_AUTH_HEADER },
    ...overrides,
  };
}

/** Mock Express Request without auth */
export function createMockRequestNoAuth(): any {
  return {
    headers: {},
  };
}

/** Fake admin instruction prompt */
export const MOCK_ADMIN_PROMPT = 'You are a fragrance expert AI assistant.';
