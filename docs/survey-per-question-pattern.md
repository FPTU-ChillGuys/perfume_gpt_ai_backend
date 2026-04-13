# Survey Per-Question Query Pattern

## Overview

This document describes the **Per-Question Query Decomposition** pattern for the Survey module, which breaks down complex survey processing into smaller, independent queries - similar to the ConversationV10 pattern but simplified.

## Problem Statement

The original `processSurveyV2AndGetAIResponse()` had a **monolithic query approach**:
- Analyzed ALL survey Q&A together → 1 complex query
- Hard to debug when results were incorrect
- Difficult to maintain and extend
- One bad question could affect all results

## Solution: Per-Question Decomposition

The new `processSurveyWithPerQuestionQueries()` pattern:
1. **Analyze EACH question independently** → extract search criteria
2. **Execute separate queries** for each question
3. **Merge results** using score-based deduplication
4. **AI analyzes merged products** → final recommendation

### Key Benefits

✅ **Modularity**: Each question is processed independently  
✅ **Debuggability**: Easy to see which question produced which products  
✅ **Resilience**: One bad question doesn't break the entire flow  
✅ **Maintainability**: Clear separation of concerns  
✅ **Performance**: Can parallelize queries if needed  

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Survey Service                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Load Q&A from Database                                  │
│     └─> Get all questions and answers                      │
│                                                              │
│  2. Per-Question Analysis (Loop)                            │
│     ┌──────────────────────────────────────┐               │
│     │ For each Q&A pair:                   │               │
│     │   ├─> analyzeSurveyQuestion()        │               │
│     │   │   └─> Extract logic, budget,    │               │
│     │   │       productNames               │               │
│     │   │                                  │               │
│     │   ├─> productService.query()         │               │
│     │   │   └─> Get products for this     │               │
│     │   │       question                   │               │
│     │   │                                  │               │
│     │   └─> Store result: {questionId,     │               │
│     │                   products[]}         │               │
│     └──────────────────────────────────────┘               │
│                                                              │
│  3. Merge Results                                            │
│     └─> mergeSurveyQueryResults()                          │
│         └─> Score-based deduplication                      │
│         └─> Sort by score (products in multiple queries)   │
│         └─> Take top N (default: 20)                       │
│                                                              │
│  4. AI Recommendation                                        │
│     ├─> Build context: all Q&A + merged products           │
│     ├─> Generate recommendation                            │
│     └─> Hydrate products                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/chatbot/output/survey-question.analysis.output.ts` | Zod schema for per-question analysis |
| `src/application/constant/prompts/survey-question.analysis.system.ts` | System prompt for analyzing single Q&A |
| `src/infrastructure/domain/survey/survey-merge.util.ts` | Merge logic utilities |
| `src/infrastructure/domain/survey/survey-per-question.example.ts` | Usage examples |

### Modified Files

| File | Changes |
|------|---------|
| `src/infrastructure/domain/ai/ai-analysis.service.ts` | Added `analyzeSurveyQuestion()` method |
| `src/infrastructure/domain/survey/survey.service.ts` | Added `processSurveyWithPerQuestionQueries()` method |

## Usage

### Basic Usage

```typescript
import { SurveyService } from './survey.service';

const surveyService = new SurveyService(...);

const surveyAnswers = [
  { questionId: 'q1', answerId: 'a1' },
  { questionId: 'q2', answerId: 'a2' },
  { questionId: 'q3', answerId: 'a3' }
];

const result = await surveyService.processSurveyWithPerQuestionQueries(
  'user-123',
  surveyAnswers
);

if (result.success && result.data) {
  const response = JSON.parse(result.data);
  console.log('Message:', response.message);
  console.log('Products:', response.products);
}
```

### Comparison with Old Approach

```typescript
// OLD: processSurveyV2AndGetAIResponse()
// - Single analysis for all Q&A
// - One query to database
// - Harder to debug

// NEW: processSurveyWithPerQuestionQueries()
// - Individual analysis per question
// - Multiple queries (one per question)
// - Score-based merge
// - Easier to debug and maintain
```

## Merge Strategy

### Score-Based Deduplication

Products are scored based on how many queries they appear in:

```typescript
// Example:
// Question 1: ["Floral", "Dior"] -> Products: [A, B, C]
// Question 2: ["Dior", "Evening"] -> Products: [B, C, D]
// Question 3: ["Floral", "Fresh"] -> Products: [A, B, E]

// Scoring:
// Product A: appears in Q1, Q3 -> score = 2
// Product B: appears in Q1, Q2, Q3 -> score = 3 (highest!)
// Product C: appears in Q1, Q2 -> score = 2
// Product D: appears in Q2 -> score = 1
// Product E: appears in Q3 -> score = 1

// Result (sorted by score): [B, A, C, D, E]
```

### Benefits of Score-Based Merge

- Products matching multiple questions get higher priority
- Naturally handles overlapping preferences
- Avoids duplicate products in final list
- Provides ranking based on relevance

## Logging & Debugging

### Log Messages

The system logs detailed information at each step:

```
[AiAnalysis] Survey question analysis completed. Question: "Bạn thích mùi hương nào?", Intent: Search, Logic groups: 2
[SurveyPerQuestion] Question "Bạn thích mùi hương nào?" -> Found 12 products
[SurveyPerQuestion] Question "Ngân sách của bạn là?" -> Found 0 products
[SurveyPerQuestion] Merging results from 5 queries...
[SurveyMerge] Merged 15 unique products from 4 queries with results
[SurveyMerge] Top products: [Dior Sauvage, Chanel Bleu, ...]
[SurveyPerQuestion] Generating AI recommendation with 15 products...
[SurveyPerQuestion] Completed. Questions: 5, Queries with results: 4, Final products: 5
```

### Debug Mode

Enable detailed logging by setting:
```bash
NODE_ENV=development
```

## Edge Cases

### 1. Empty Survey Answers

```typescript
await surveyService.processSurveyWithPerQuestionQueries(userId, []);
// Throws: "No valid question-answer pairs found"
```

### 2. Invalid Question IDs

```typescript
await surveyService.processSurveyWithPerQuestionQueries(userId, [
  { questionId: 'invalid-id', answerId: 'a1' }
]);
// Throws: "Failed to get survey question"
```

### 3. Questions with No Products

```typescript
// If a question has no matching products:
// - Query returns empty array
// - Still tracked in results
// - Doesn't affect other questions
// - System may fallback to bestsellers if ALL questions fail
```

### 4. All Questions Fail

```typescript
// If no products found from ANY question:
// - System automatically falls back to bestsellers
// - Products marked with source: 'BEST_SELLER_FALLBACK'
// - Ensures user always gets some recommendations
```

## Performance Considerations

### Current Implementation

- **Sequential execution**: Questions are processed one by one
- **Easy to debug**: Clear log flow
- **Good for small surveys** (5-10 questions)

### Future Optimization

For larger surveys, consider parallel execution:

```typescript
// Option: Parallel processing
const queryResults = await Promise.all(
  quesAnses.map(async (qa) => {
    const analysis = await this.analysisService.analyzeSurveyQuestion(qa);
    const searchResponse = await this.productService.getProductsByStructuredQuery(analysis);
    return { questionId: qa.questionId, products: searchResponse.data?.items || [] };
  })
);
```

**Trade-offs**:
- ✅ Faster for many questions
- ❌ Harder to debug (logs interleaved)
- ❌ More database load

**Recommendation**: Start with sequential, optimize to parallel if needed.

## Testing

### Unit Tests

```bash
pnpm test survey.service.spec.ts
```

Test coverage:
- ✅ `analyzeSurveyQuestion()` with various Q&A pairs
- ✅ `mergeSurveyQueryResults()` with multiple queries
- ✅ Edge cases (empty, invalid, no products)

### Integration Tests

```typescript
// Create survey with 5 questions
// Run processSurveyWithPerQuestionQueries()
// Verify:
// - Each question → 1 query
// - Products merged correctly (deduplicate, score-based)
// - AI response has message + products
```

### Manual Testing

```bash
# Run backend
pnpm run dev

# Call survey endpoint with 5 questions
# Check logs for:
# - [AiAnalysis] Survey question analysis completed
# - [SurveyMerge] Merged X products from Y queries
# - Final AI response has appropriate products
```

## Migration Guide

### From Old to New

1. **Identify usage**: Find all calls to `processSurveyV2AndGetAIResponse()`
2. **Replace method**: Change to `processSurveyWithPerQuestionQueries()`
3. **Test**: Verify results are similar or better
4. **Monitor**: Watch logs for any issues
5. **Deprecate**: Once confident, mark old method as deprecated

### Backward Compatibility

- ✅ Old method `processSurveyV2AndGetAIResponse()` still works
- ✅ No breaking changes to existing code
- ✅ Can migrate gradually
- ✅ Can A/B test both approaches

## Best Practices

1. **Use new method for**:
   - New survey implementations
   - Complex surveys (5+ questions)
   - When debuggability is important

2. **Keep old method for**:
   - Simple surveys (2-3 questions)
   - Performance-critical paths
   - Legacy code not ready to migrate

3. **Monitor logs**:
   - Watch for questions with 0 products
   - Check merge statistics
   - Verify AI recommendations are relevant

4. **Iterate on prompts**:
   - `SURVEY_QUESTION_ANALYSIS_SYSTEM_PROMPT` can be tuned
   - Adjust temperature for more/less creative analysis
   - Add examples for better accuracy

## Future Enhancements

### Potential Improvements

1. **Question Weighting**:
   - Some questions may be more important than others
   - Add weight parameter to boost score

2. **Question Type Detection**:
   - Personal preference vs factual questions
   - Different merge logic for each type

3. **Caching**:
   - Cache analysis results for repeated questions
   - Reduce AI calls for common patterns

4. **Adaptive Merge**:
   - Dynamic topN based on survey size
   - Smart fallback strategies

5. **Analytics**:
   - Track which questions produce best results
   - Optimize survey design based on data

## Related Documentation

- [ConversationV10 Pattern](../../docs/conversation-v10-pattern.md) - Similar decomposition pattern
- [Survey Architecture](../../docs/survey-architecture.md) - Overall survey system design
- [AI Analysis Service](../../docs/ai-analysis-service.md) - AI analysis capabilities

## Questions?

If you have questions or issues with the per-question pattern:
1. Check the logs for detailed information
2. Review the examples in `survey-per-question.example.ts`
3. Compare with ConversationV10 implementation
4. Reach out to the team for support

---

**Last Updated**: April 13, 2026  
**Author**: AI Assistant  
**Status**: ✅ Implemented, Ready for Testing
