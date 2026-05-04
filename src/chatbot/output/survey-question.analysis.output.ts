import z from 'zod';

// ====== Shared sub-schemas (reused from analysis.output.ts) ======
const sortingSchema = z
  .object({
    field: z.enum(['Price', 'Sales', 'Volume', 'Newest', 'Relevance', 'Name']),
    isDescending: z.boolean()
  })
  .nullable();

const budgetSchema = z
  .object({
    min: z.number().nullable(),
    max: z.number().nullable()
  })
  .nullable();

// ====== SurveyAnswerAnalysis: single answer analysis ======
export const surveyAnswerAnalysisSchema = z
  .object({
    intent: z
      .enum([
        'Search',
        'Consult',
        'Recommend',
        'Compare',
        'Greeting',
        'Chat',
        'Task',
        'Unknown'
      ])
      .describe('The core intent of this specific survey answer.'),
    logic: z
      .array(z.union([z.string(), z.array(z.string())]))
      .nullable()
      .describe(
        'CNF logic for this specific answer only. Keep focused on ONE intent. MUST use searchMasterData to normalize keywords.'
      ),
    genderValues: z
      .array(z.string())
      .nullable()
      .describe('Nếu người dùng nhắc giới tính (nam/nữ/unisex), đưa vào trường này (VD: ["Male", "Female", "Unisex"]). KHÔNG đưa vào logic.'),
    productNames: z
      .array(z.string())
      .nullable()
      .describe('Product names relevant to THIS answer only.'),
    sorting: sortingSchema,
    budget: budgetSchema,
    explanation: z
      .string()
      .describe(
        'Short explanation of the analysis in Vietnamese (visible to main AI only).'
      ),
    normalizationMetadata: z
      .array(
        z.object({
          original: z.string().describe('The raw keyword from the answer.'),
          corrected: z
            .string()
            .describe('The normalized keyword as found in the database.'),
          type: z.enum([
            'brand',
            'category',
            'note',
            'family',
            'attribute',
            'product',
            'unknown'
          ]),
          isNormalized: z
            .boolean()
            .describe('Whether a matching official term was found.')
        })
      )
      .nullable()
      .describe('Log of keyword normalization process via searchMasterData')
  })
  .describe(
    'Analysis result for a single survey answer. MUST use searchMasterData tool to normalize keywords before building logic.'
  );

export type SurveyAnswerAnalysisObject = z.infer<
  typeof surveyAnswerAnalysisSchema
>;

export const surveyAnswerAnalysis = {
  schema: surveyAnswerAnalysisSchema
};
