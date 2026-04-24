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
    analysis: Record<string, unknown>
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
        const originalContent = (originalMessage as any).content || '';

        // Create the injected text
        const injectedText = `[USER_REQUEST_ANALYSIS]\n${JSON.stringify(analysis, null, 2)}\n\n[USER_MESSAGE]\n${originalContent}`;

        // Update parts if they exist (Vercel AI SDK 4.x/6.x multi-turn compatibility)
        const originalParts = (originalMessage as any).parts;
        let newParts = originalParts;

        if (Array.isArray(originalParts)) {
            newParts = originalParts.map((part: any) => {
                if (part.type === 'text') {
                    return { ...part, text: injectedText };
                }
                return part;
            });
        }

        // Create a new message object with the injected analysis in both places
        (finalMessages[lastUserMessageIndex] as any) = {
            ...originalMessage,
            content: injectedText,
            parts: newParts
        };
    }

    return finalMessages;
}
