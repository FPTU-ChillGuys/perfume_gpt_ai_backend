import { UIMessage } from 'ai';

/**
 * Injects structured analysis results into the content of the latest user message.
 * This helps the Main AI understand the extracted intent, DNF logic, and budget 
 * exactly context-aware with the user's latest query.
 * 
 * @param messages Current conversation messages
 * @param analysis Structured analysis object from Intermediate AI
 * @returns A new array of messages with the analysis injected into the last user message
 */
export function injectAnalysisToLastUserMessage(
    messages: UIMessage[],
    analysis: any
): UIMessage[] {
    if (!messages || messages.length === 0 || !analysis) {
        return messages;
    }

    const finalMessages = [...messages];
    const lastUserMessageIndex = [...finalMessages]
        .map((m, i) => ({ m, i }))
        .reverse()
        .find((x) => x.m.role === 'user')?.i;

    if (lastUserMessageIndex !== undefined) {
        const originalMessage = finalMessages[lastUserMessageIndex];

        // Create a new message object with the injected analysis
        finalMessages[lastUserMessageIndex] = {
            ...originalMessage,
            content: `[USER_REQUEST_ANALYSIS]\n${JSON.stringify(analysis, null, 2)}\n\n[USER_MESSAGE]\n${(originalMessage as any).content}`
        } as any;
    }

    return finalMessages;
}
