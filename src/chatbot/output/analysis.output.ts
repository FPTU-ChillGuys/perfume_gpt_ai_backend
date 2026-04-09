import z from 'zod';

// ====== Shared sub-schemas ======
const sortingSchema = z.object({
    field: z.enum(['Price', 'Sales', 'Volume', 'Newest', 'Relevance', 'Name']),
    isDescending: z.boolean()
}).nullable();

const budgetSchema = z.object({
    min: z.number().nullable(),
    max: z.number().nullable()
}).nullable();

const functionCallSchema = z.object({
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
}).nullable();

// ====== QueryItem: single-purpose decomposed query ======
export const queryItemSchema = z.object({
    purpose: z.enum(['search', 'function', 'profile'])
        .describe('Purpose of this query: search=keyword product search, function=call backend function, profile=fetch user profile preferences then search'),
    logic: z.array(z.union([z.string(), z.array(z.string())]))
        .nullable()
        .describe('CNF logic for this specific query purpose only. Keep each query focused on ONE intent.'),
    productNames: z.array(z.string()).nullable()
        .describe('Product names relevant to THIS query only.'),
    sorting: sortingSchema,
    budget: budgetSchema,
    functionCall: functionCallSchema
        .describe('Only used when purpose="function". Specifies which backend function to call.'),
    profileHint: z.string().nullable()
        .describe('Only used when purpose="profile". Hint for the system on what to extract from user profile/order history (e.g. "sở thích mùi hương", "phong cách cá nhân").')
});

// ====== Main Analysis Output ======
export const analysisOutputSchema = z.object({
    intent: z.enum(['Search', 'Consult', 'Recommend', 'Compare', 'Greeting', 'Chat', 'Task', 'Unknown'])
        .describe('The core intent of the user message. Use "Recommend" for advice/suggestions requesting personalized picks, "Task" for actions.'),
    // ====== NEW: Decomposed multi-query array ======
    queries: z.array(queryItemSchema).nullable()
        .describe('Array of decomposed sub-queries. Each query has ONE purpose and runs independently. Results are merged. If user asks multiple things (e.g. "bestseller + my taste + autumn"), split into separate queries. If null/empty, the system falls back to legacy root-level fields below.'),
    // ====== Legacy root-level fields (backward-compatible, used as fallback) ======
    logic: z.array(z.union([z.string(), z.array(z.string())]))
        .describe('[LEGACY] Conjunctive Normal Form (CNF) logic for product attributes. Prefer using queries[] instead.'),
    productNames: z.array(z.string()).nullable()
        .describe('[LEGACY] Explicit list of product names mentioned by the user.'),
    sorting: sortingSchema,
    budget: budgetSchema,
    functionCall: functionCallSchema
        .describe('[LEGACY] Instructs the system to use a specific backend function. Prefer using queries[] with purpose="function" instead.'),
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

export type QueryItemObject = z.infer<typeof queryItemSchema>;
export type AnalysisObject = z.infer<typeof analysisOutputSchema>;
export type IntentOnlyObject = z.infer<typeof intentOnlyOutputSchema>;

export const analysisOutput = {
    schema: analysisOutputSchema
};

export const intentOnlyOutput = {
    schema: intentOnlyOutputSchema
};
