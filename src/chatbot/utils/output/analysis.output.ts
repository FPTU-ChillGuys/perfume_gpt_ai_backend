import z from 'zod';

export const analysisOutputSchema = z.object({
    intent: z.enum(['Search', 'Consult', 'Compare', 'Greeting', 'Chat', 'Unknown'])
        .describe('The core intent of the user message.'),
    logic: z.array(z.union([z.string(), z.array(z.string())]))
        .describe('Disjunctive Normal Form (DNF) logic for product attributes. e.g. [["Chanel", "Nước hoa nữ"], "Dior"] means (Chanel AND Nước hoa nữ) OR Dior.'),
    productNames: z.array(z.string()).optional()
        .describe('Explicit list of product names mentioned by the user (e.g. ["Bleu de Chanel", "Sauvage"]).'),
    sorting: z.object({
        field: z.enum(['Price', 'Sales', 'Volume', 'Newest', 'Relevance', 'Name']).default('Relevance'),
        isDescending: z.boolean().default(true)
    }).optional(),
    budget: z.object({
        min: z.number().optional(),
        max: z.number().optional()
    }).optional(),
    pagination: z.object({
        pageNumber: z.number().default(1),
        pageSize: z.number().default(10)
    }).optional(),
    originalRequestVietnamese: z.string().describe('The user\'s original message in Vietnamese.'),
    normalizationMetadata: z.array(z.object({
        original: z.string().describe('The raw keyword from the user.'),
        corrected: z.string().describe('The normalized keyword as found in the database.'),
        type: z.enum(['brand', 'category', 'note', 'family', 'attribute', 'product', 'unknown']),
        isNormalized: z.boolean().describe('Whether a matching official term was found.')
    })).optional().describe('Log of keyword normalization/correction process.'),
    explanation: z.string().describe('Short explanation of the analysis in Vietnamese (visible to main AI only).')
});

export type AnalysisObject = z.infer<typeof analysisOutputSchema>;

export const analysisOutput = {
    schema: analysisOutputSchema
};
