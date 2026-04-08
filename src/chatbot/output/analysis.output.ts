import z from 'zod';

export const analysisOutputSchema = z.object({
    intent: z.enum(['Search', 'Consult', 'Recommend', 'Compare', 'Greeting', 'Chat', 'Task', 'Unknown'])
        .describe('The core intent of the user message. Use "Recommend" for advice/suggestions requesting personalized picks, "Task" for actions.'),
    logic: z.array(z.union([z.string(), z.array(z.string())]))
        .describe('Conjunctive Normal Form (CNF) logic for product attributes. e.g. [["Chanel", "Dior"], "Nữ"] means (Chanel OR Dior) AND Nữ.'),
    productNames: z.array(z.string()).nullable()
        .describe('Explicit list of product names mentioned by the user (e.g. ["Bleu de Chanel", "Sauvage"]).'),
    sorting: z.object({
        field: z.enum(['Price', 'Sales', 'Volume', 'Newest', 'Relevance', 'Name']),
        isDescending: z.boolean()
    }).nullable(),
    budget: z.object({
        min: z.number().nullable(),
        max: z.number().nullable()
    }).nullable(),
    functionCall: z.object({
        name: z.enum([
            'getBestSellingProducts',
            'getNewestProducts',
            'getLeastSellingProducts',
            'getOrdersByUserId',
            'getStaticProductPolicy',
            'getUserLogSummaryByUserId',
            'addToCart',
            'getCart',
            'clearCart'
        ]),
        purpose: z.enum(['main', 'support', 'task']),
        arguments: z.object({
                    items: z.array(
                        z.object({
                            variantId: z.string().nullable(),
                            quantity: z.number().nullable()
                        })
                    ).nullable(),
                    content: z.string().nullable(),
                    variantId: z.string().nullable(),
                    quantity: z.number().nullable()
                }).nullable()
    }).nullable()
        .describe('Instructs the system to use a specific backend function. Use "task" for actions like addToCart.'),
    pagination: z.object({
        pageNumber: z.number(),
        pageSize: z.number()
    }).nullable(),
    originalRequestVietnamese: z.string().describe('The user\'s original message in Vietnamese.'),
    normalizationMetadata: z.array(z.object({
        original: z.string().describe('The raw keyword from the user.'),
        corrected: z.string().describe('The normalized keyword as found in the database.'),
        type: z.enum(['brand', 'category', 'note', 'family', 'attribute', 'product', 'unknown']),
        isNormalized: z.boolean().describe('Whether a matching official term was found.')
    })).nullable().describe('Log of keyword normalization/correction process.'),
    explanation: z.string().describe('Short explanation of the analysis in Vietnamese (visible to main AI only).')
});

export const intentOnlyOutputSchema = z.object({
    intent: z.enum(['Search', 'Consult', 'Recommend', 'Compare', 'Greeting', 'Chat', 'Task', 'Unknown'])
        .describe('The core intent of the user message. Use "Recommend" for advice/suggestions requesting personalized picks, "Task" for actions.')
});

export type AnalysisObject = z.infer<typeof analysisOutputSchema>;
export type IntentOnlyObject = z.infer<typeof intentOnlyOutputSchema>;

export const analysisOutput = {
    schema: analysisOutputSchema
};

export const intentOnlyOutput = {
    schema: intentOnlyOutputSchema
};
