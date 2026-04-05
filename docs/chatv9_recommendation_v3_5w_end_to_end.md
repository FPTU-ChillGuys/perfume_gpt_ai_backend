# ChatV9 to RecommendationV3 - End-to-End Process (5W Deep Dive)

## 1) Document Goal

This document explains in detail the full execution flow:

- From incoming message at ChatV9 endpoint
- Through intent detection, NLP extraction, route decision
- Into RecommendationV3 profile build, candidate retrieval, scoring, ranking
- Until final response is returned and conversation is queued for persistence

The explanation uses 5W for each critical phase:

- What: What is happening in this step?
- When: When does this step run?
- Who: Which component/service performs it?
- Where: Which code location/file handles it?
- How: How does it work internally?

It also includes realistic examples with explicit intermediate values.

---

## 2) High-Level Architecture Snapshot

### 2.1 Runtime actors

- Client/App
- ConversationController
- ConversationV9Service
- AiAnalysisService (intent only)
- NlpEngineService (keyword parsing)
- RecommendationV3Service (if intent=Recommend)
- ProductService (if intent=Search/Consult or hydration)
- AIHelper (final structured generation)
- BullMQ conversation queue
- ConversationProcessor + ConversationService persistence
- Trace file logger (logs/ai_recommendation_trace.txt)

### 2.2 Sequence at a glance

1. Client calls POST /conversation/chat/v9.
2. Controller forwards to ConversationV9Service.chatV9.
3. ChatV9 builds combined prompt and calls processAiChatResponseV9.
4. AI intent-only analysis classifies message.
5. Local NLP extracts brands/scents/genders/product names.
6. Router branch:
   - Recommend -> call RecommendationV3Service
   - Search/Consult -> call ProductService search
   - Others -> no tool injection
7. Final LLM generation builds structured response (message/products/productTemp/suggestedQuestions).
8. Hydration maps productTemp IDs to full product cards.
9. Trace logs are appended to logs/ai_recommendation_trace.txt.
10. Final conversation is enqueued to conversation_queue for async save.
11. API returns BaseResponse<ConversationDto>.

---

## 3) ChatV9 End-to-End (Detailed 5W)

## 3.1 Entry point: HTTP endpoint

What
- Accepts conversation request and routes to ChatV9 engine.

When
- Every time client calls POST /conversation/chat/v9.

Who
- ConversationController.

Where
- src/api/controllers/conversation.controller.ts

How
- If request body does not include userId, controller tries to read it from JWT token.
- Then it calls conversationV9Service.chatV9(conversation).

Example
- Incoming body:
  - id: "conv-123"
  - userId: null
  - messages: [ ... ]
- Token payload id = "0c6b..."
- Controller sets conversation.userId = "0c6b..." and forwards.

---

## 3.2 Step A: Input normalization in chatV9

What
- Normalizes user identity and message format.

When
- Immediately after entering service method chatV9.

Who
- ConversationV9Service.chatV9.

Where
- src/infrastructure/domain/conversation/conversation-v9.service.ts

How
- userId = conversation.userId ?? uuid()
- convertToMessages maps MessageRequestDto[] into UIMessage[] format.
- Each message is converted to role user/assistant + parts text.

Example
- Request messages:
  - sender=user, message="Toi can chai nuoc hoa re re cho mua he"
- Converted UIMessage:
  - role=user
  - parts[0].type=text
  - parts[0].text="Toi can chai nuoc hoa re re cho mua he"

---

## 3.3 Step B: Build combined prompt

What
- Builds system context used for final AI generation.

When
- Before route decision and before final text generation.

Who
- buildCombinedPromptV5 + AdminInstructionService.

Where
- src/infrastructure/domain/utils/prompt-builder.ts
- Called from ConversationV9Service.chatV9

How
- Pull admin instruction by domain type INSTRUCTION_TYPE_CONVERSATION.
- Embed user id marker.
- Return combined prompt payload.
- If failed, throw InternalServerErrorWithDetailsException.

Example
- Combined prompt may include:
  - "Huong dan quan tri vien: ..."
  - "[ID nguoi dung: 0c6b... ]"

---

## 3.4 Step C: processAiChatResponseV9 orchestration

What
- Main orchestration pipeline from analysis to final response.

When
- Called by chatV9 after prompt is built.

Who
- ConversationV9Service.processAiChatResponseV9.

Where
- src/infrastructure/domain/conversation/conversation-v9.service.ts

How
- Executes Phases 1 -> 5 + logging + queue persistence.

---

## 3.5 Phase 1: Intent-only analysis

What
- Predicts high-level intent class for routing.

When
- At start of processAiChatResponseV9, before product retrieval.

Who
- AiAnalysisService.analyzeIntentOnly.

Where
- src/infrastructure/domain/ai/ai-analysis.service.ts
- Called from conversation-v9.service.ts

How
- Picks last user message text from convertedMessages.
- Sends { previousMessages, currentMessage } to intent-only prompt.
- Uses structured output schema intentOnlyOutput.
- Falls back to intent="Chat" if null/empty.

Possible intents
- Search, Consult, Recommend, Compare, Greeting, Chat, Task, Unknown.

Example
- Input: "Toi can mot chai nuoc hoa giong Dior, tam 1 trieu"
- Predicted intent: Recommend.

---

## 3.6 Phase 2: Local NLP extraction

What
- Extracts entities/keywords for contextual hints.

When
- Right after intent detection.

Who
- NlpEngineService (natural/wink backend).

Where
- src/infrastructure/domain/common/nlp-engine.service.ts
- Called from conversation-v9.service.ts

How
- parseAndNormalize(messageText)
- Reads byType buckets:
  - brand
  - product_name
  - scent_note
  - gender
- Creates pseudoChatContext (AnalysisObject-like) for recommendation service call.

Example extraction
- Message: "Toi muon mui citrus cua Dior cho nam"
- nlpBrands = ["dior"]
- nlpScents = ["citrus"]
- nlpGenders = ["nam"]
- nlpProductNames = []

Important note
- In current V3 implementation, chatContext is passed into RecommendationV3Service but not used in scoring/query logic yet.

---

## 3.7 Phase 3 Router: action branching by intent

What
- Chooses branch: Recommend vs Search/Consult vs default chat.

When
- After intent + NLP are available.

Who
- ConversationV9Service.

Where
- conversation-v9.service.ts in processAiChatResponseV9.

How

### Branch A: Recommend

1) Build dynamic weights by keyword rule
- default mode
  - brand 0.25
  - scent 0.40
  - survey 0.10
  - season 0.12
  - age 0.08
  - budget 0.05

- budget_focus if message includes words like:
  - gia, tien, tam, khoang, ngan sach, re, dat, trieu, k

- season_focus if message includes:
  - mua, nong, lanh, he, dong, thu, xuan, thoi tiet

- similar_focus if message includes:
  - giong, tuong tu, nhu chai, cung loai

Important behavior
- Rule chain is if/else if.
- The first matched branch wins.
- If message has both budget and season words, budget_focus wins.

2) Call RecommendationV3Service
- getRecommendations(userId, 1, pseudoChatContext, targetWeights)
- size=1 means only top 1 recommendation is requested.

3) Inject recommendation payload back to AI context
- Build minimalProducts with source="RECOMMENDATION_RESULTS"
- Encode via encodeToolOutput
- Add as synthetic system message:
  - "RECOMMENDATION_RESULTS (...): <encoded payload>"

4) Continue to final AI generation with enriched context.

Example
- Message: "Toi can chai re re, mui citrus cho mua he"
- Matched mode: budget_focus (because budget keywords checked first)
- targetWeights becomes budget-heavy profile.

### Branch B: Search or Consult

1) Call ProductService.getProductsUsingParsedSearch(...)
- currently page size 1 in this route

2) Build SEARCH_RESULTS payload
- source="SEARCH_RESULTS"
- encode and inject as system message

3) Continue to final AI generation.

### Branch C: Other intents

- No recommendation/search injection.
- AI responds based on conversation context + prompts.

---

## 3.8 Phase 4: Final AI structured generation

What
- Generates final assistant response object in strict schema.

When
- After optional recommendation/search injection.

Who
- AIHelper.textGenerateFromMessages.

Where
- src/infrastructure/domain/helpers/ai.helper.ts
- Output schema in src/chatbot/output/search.output.ts (conversationOutput)

How
- systemPrompt = conversationSystemPrompt(adminInstruction, combinedPrompt)
- Calls textGenerateFromMessages(finalMessages, systemPrompt, Output.object(conversationOutput))
- conversationOutput schema requires:
  - message: string
  - products: product cards or null
  - productTemp: temp products or null
  - suggestedQuestions: string[]

Failure behavior
- If generation fails or empty, throws InternalServerErrorWithDetailsException.

---

## 3.9 Phase 5: Hydration from productTemp -> products

What
- Enriches AI temporary product picks into full product cards from DB.

When
- Right after AI returns structured output and productTemp exists.

Who
- ConversationV9Service + ProductService.getProductsByIdsForOutput.

Where
- conversation-v9.service.ts
- Product card schema in src/chatbot/output/product.output.ts

How
- Collect ids from aiResponse.productTemp.
- Query ProductService by IDs.
- Build map for recommended variant IDs and reasoning/source.
- Attach reasoning/source into hydrated products.
- Filter only products with at least one variant.

Example
- productTemp item:
  - id="prod-1"
  - variants=[{"id":"var-7","price":990000}]
  - reasoning="Hop ngan sach va mui citrus"
- Hydrated product keeps only variant var-7 and carries reasoning/source.

---

## 3.10 Logging, trace file, and async persistence

What
- Captures trace and stores conversation asynchronously.

When
- End of process, before returning API response.

Who
- ConversationV9Service + BullMQ + ConversationProcessor.

Where
- Trace file append in conversation-v9.service.ts
- Queue/job constants in src/application/constant/processor.ts
- Processor in src/infrastructure/domain/processor/conversation.processor.ts

How
- Appends traceLogs to logs/ai_recommendation_trace.txt.
- Creates responseConversation with assistant message appended.
- Adds Bull job:
  - queue: conversation_queue
  - job: add_message_and_log
- Processor consumes job and calls conversationService.saveOrUpdateConversation(...)

Why async queue
- API response is not blocked by persistence I/O complexity.
- Better resilience and throughput.

---

## 4) RecommendationV3 Detailed Flow (Build Profile -> Final Recommend)

## 4.1 Service role and entry

What
- Computes personalized recommendation list from user purchase history profile.

When
- Called only when ChatV9 intent branch is Recommend.

Who
- RecommendationV3Service.getRecommendations.

Where
- src/infrastructure/domain/recommendation/recommendation-v3.service.ts

How
- Receives userIdRaw, size, chatContext (optional), weights (optional).

Note
- userService is injected but currently not used by this service logic.

---

## 4.2 Step 1: Normalize user id and build profile

What
- Creates compact user preference profile.

When
- First step inside getRecommendations.

Who
- RecommendationV3Service.buildProfile.

Where
- recommendation-v3.service.ts

How

1) Initialize default profile
- topBrands = []
- topScents = []
- avgPrice = 1,000,000
- budgetRange = [500,000, 2,000,000]
- age = 25

2) Fetch age from customerProfiles
- if DateOfBirth exists:
  - age = currentYear - birthYear

3) Fetch delivered orders with nested details
- from orders where:
  - CustomerId = userId
  - Status = Delivered
- include OrderDetails -> ProductVariants -> Products -> Brands + ProductNoteMaps -> ScentNotes

4) Aggregate preference maps
- brand frequency map
- scent frequency map
- total price and quantity

5) Compute profile features
- topBrands = top 3 by frequency
- topScents = top 5 by frequency
- avgPrice = totalPrice / totalItems
- budgetRange = [avgPrice*0.5, avgPrice*1.5]

Important reality
- Survey fallback is only a comment placeholder in current V3.
- No survey data is read or scored in execution path.

Example
- Delivered order history implies:
  - Brand counts: Dior=8, Chanel=5, Versace=3
  - Scent counts: citrus=9, vanilla=4, woody=3
  - totalPrice=12,000,000 and totalItems=10
- Built profile:
  - topBrands=[Dior, Chanel, Versace]
  - topScents=[citrus, vanilla, woody]
  - avgPrice=1,200,000
  - budgetRange=[600,000, 1,800,000]

---

## 4.3 Step 2: cold preference check

What
- Decides if system has any meaningful preference signal.

When
- Immediately after profile build.

Who
- RecommendationV3Service.getRecommendations.

Where
- recommendation-v3.service.ts

How
- hasAnyPreference = topBrands.length > 0 OR topScents.length > 0
- if false -> fallback recommendations (currently empty list payload)

Implication
- New user with no delivered orders likely returns fallback response.

---

## 4.4 Step 3: candidate retrieval (database query phase)

What
- Retrieves a candidate pool for ranking.

When
- Only if profile has at least one preference.

Who
- RecommendationV3Service.generateCandidates.

Where
- recommendation-v3.service.ts

How

Primary query
- Query products with OR conditions.
- Current practical condition implemented:
  - Brand name IN profile.topBrands (if topBrands not empty)
- Include:
  - Brands
  - ProductNoteMaps with ScentNotes
  - ProductVariants where Status=Active, take 1, order BasePrice desc
- take fetchLimit*2 rows (fetchLimit = size*5 from caller)

Safety fallback query
- If primary result count < 5:
  - Query broader latest products with active variants
  - take fetchLimit

Candidate mapping
- Maps product entity to lightweight candidate object:
  - productId
  - variantId
  - productName
  - brand
  - basePrice
  - scentNotes lowercase array

Critical understanding
- Weight values do not affect this SQL query stage.
- Weights only affect ranking later.

---

## 4.5 Step 4: scoring each candidate

What
- Computes component scores then weighted total score.

When
- After candidate pool retrieval.

Who
- RecommendationV3Service.calculateScores + getRecommendations scorer loop.

Where
- recommendation-v3.service.ts

How

A) Merge active weights
- activeWeights = { ...DEFAULT_WEIGHTS, ...weightsFromChatV9 }

B) Component score rules

1) brandScore
- base 0.3
- if product brand exactly in topBrands -> 1.0

2) scentScore
- base 0.3
- count overlapping scent notes with profile topScents
- if matches > 0:
  - scentScore = min(1.0, 0.3 + (matches/totalScentNotes)*0.7)

3) budgetScore
- start 0.5
- if price <= budget max -> 1.0
- else if price <= max*1.5 -> 0.5
- else -> 0.1

4) seasonScore
- start 0.5
- isSummer if month in [May..Sep] using getMonth 4..8
- if summer and scent contains one of citrus/aqua/fresh/ocean -> 1.0
- if not summer and scent contains warm/spice/vanilla/woody/amber -> 1.0

C) Weighted total
- totalScore =
  - brandScore*brandWeight
  - + scentScore*scentWeight
  - + budgetScore*budgetWeight
  - + seasonScore*seasonWeight
- final public score = min(100, round(totalScore*100))

Important detail
- survey and age weights exist in type/default but are not used in current totalScore formula.

---

## 4.6 Step 5: ranking and dedup

What
- Produces final top-N recommendation list.

When
- After all candidates have scores.

Who
- RecommendationV3Service.getRecommendations.

Where
- recommendation-v3.service.ts

How
- Sort scoredProducts by score descending.
- Deduplicate by productId (keep first/highest variant).
- Stop when deduped length reaches requested size.

Return payload
- success true
- data:
  - userId
  - recommendations
  - totalProducts
  - profile summary (age, budgetRange, avgPrice, topBrands, topScents)

Error path
- Any thrown error -> logs V3_ERROR -> fallback recommendations.

---

## 5) 5W Matrix (ChatV9 and RecommendationV3)

## 5.1 ChatV9 matrix

| Phase | What | When | Who | Where | How |
|---|---|---|---|---|---|
| API entry | Receive conversation request | At HTTP POST /conversation/chat/v9 | ConversationController | conversation.controller.ts | Fill missing userId from JWT, call chatV9 |
| Message normalize | Convert DTO message to UIMessage | Start of chatV9 | ConversationV9Service + helper | conversation-v9.service.ts + message-helper.ts | sender -> role mapping and text part creation |
| Prompt build | Build combined system context | Before orchestration | buildCombinedPromptV5 + AdminInstructionService | prompt-builder.ts | Fetch admin instruction, append user marker |
| Intent detect | Classify message intent | First phase in processAiChatResponseV9 | AiAnalysisService | ai-analysis.service.ts | intent-only structured analysis |
| NLP parse | Extract entities | Right after intent | NlpEngineService | nlp-engine.service.ts | parseAndNormalize, read byType buckets |
| Route decision | Choose Recommend/Search/Chat branch | After intent+NLP | ConversationV9Service | conversation-v9.service.ts | if intent conditions |
| Recommend branch | Build weights + call V3 + inject tool output | intent=Recommend | ConversationV9Service + RecommendationV3Service | conversation-v9.service.ts | Rule-based mode switching and encoded system injection |
| Search branch | Product search + inject tool output | intent=Search/Consult | ConversationV9Service + ProductService | conversation-v9.service.ts | getProductsUsingParsedSearch then encoded injection |
| Final generation | Build final structured AI output | After routing | AIHelper | ai.helper.ts | Output.object(conversationOutput) |
| Hydration | Resolve productTemp ids to full cards | If productTemp exists | ConversationV9Service + ProductService | conversation-v9.service.ts | Query by ids, map reasoning/source |
| Trace write | Append detailed trace file | End of process | ConversationV9Service | logs/ai_recommendation_trace.txt | fs appendFileSync |
| Async save | Queue conversation save | End before return | ConversationV9Service + Bull + Processor | conversation-v9.service.ts + conversation.processor.ts | add_message_and_log job |

## 5.2 RecommendationV3 matrix

| Phase | What | When | Who | Where | How |
|---|---|---|---|---|---|
| Start | Initialize recommendation run | Called by ChatV9 Recommend branch | RecommendationV3Service | recommendation-v3.service.ts | Normalize userId and log |
| Build profile | Create compact preference profile | First major step | RecommendationV3Service + Prisma | recommendation-v3.service.ts | Query age + delivered orders, aggregate maps |
| Preference check | Decide if enough signal exists | After profile build | RecommendationV3Service | recommendation-v3.service.ts | topBrands/topScents emptiness check |
| Candidate query | Retrieve product pool | If preference exists | RecommendationV3Service + Prisma | recommendation-v3.service.ts | Brand-based OR query + fallback broad query |
| Component scoring | Compute brand/scent/budget/season scores | For each candidate | RecommendationV3Service | recommendation-v3.service.ts | Rule-based score calculation |
| Weighted ranking | Convert to final score | After component scores | RecommendationV3Service | recommendation-v3.service.ts | Weighted sum then scale to 100 |
| Dedup and cut | Keep one variant/product and top-N | Final phase | RecommendationV3Service | recommendation-v3.service.ts | sort desc + Set productId dedup |
| Return | Send recommendation payload | End success path | RecommendationV3Service | recommendation-v3.service.ts | include profile summary and recommendations |

---

## 6) Worked Example A (Recommend branch with explicit numbers)

User message
- "Toi can mot chai nuoc hoa re re cho mua he, mui citrus, thuong hieu Dior"

### Step A1 - intent and NLP

- Intent predicted: Recommend
- NLP extraction:
  - brands: ["dior"]
  - scents: ["citrus"]
  - genders: []
  - product names: []

### Step A2 - dynamic weight mode

Message includes both budget words ("re re") and season words ("mua he").
Due to if/else order, budget branch wins.

Selected mode
- budget_focus

Active weights passed to RecommendationV3Service
- budget: 0.50
- brand: 0.10
- scent: 0.10
- survey: 0.10 (not used in V3 formula)
- season: 0.10
- age: 0.10 (not used in V3 formula)

### Step A3 - build profile from orders

Assume profile built from delivered order history:

- topBrands = ["Dior", "Chanel", "Versace"]
- topScents = ["citrus", "vanilla", "woody"]
- avgPrice = 1,200,000
- budgetRange = [600,000, 1,800,000]
- age = 27

### Step A4 - candidate retrieval

Suppose query returns these candidates:

1) Dior Fresh Citrus EDT
- brand Dior
- price 950,000
- scentNotes ["citrus", "fresh", "bergamot"]

2) Chanel Amber Night
- brand Chanel
- price 2,600,000
- scentNotes ["amber", "woody", "vanilla"]

3) Local Citrus Sport
- brand LocalBrand
- price 700,000
- scentNotes ["citrus", "aqua"]

### Step A5 - component scoring

Assume current month is summer.

Candidate 1: Dior Fresh Citrus EDT
- brandScore = 1.0 (Dior in topBrands)
- scentScore:
  - matches with profile topScents = citrus only (1 match out of 3 notes)
  - score = 0.3 + (1/3)*0.7 = 0.533
- budgetScore = 1.0 (950,000 <= 1,800,000)
- seasonScore = 1.0 (summer and has fresh/citrus)

Candidate 2: Chanel Amber Night
- brandScore = 1.0
- scentScore:
  - matches vanilla, woody = 2/3
  - score = 0.3 + (2/3)*0.7 = 0.767
- budgetScore = 0.5 or 0.1 depending threshold:
  - max*1.5 = 2,700,000
  - price 2,600,000 <= 2,700,000 -> 0.5
- seasonScore = 0.5 (summer but warm profile note, no fresh key)

Candidate 3: Local Citrus Sport
- brandScore = 0.3 (brand not in topBrands)
- scentScore:
  - citrus matches 1/2
  - score = 0.3 + 0.5*0.7 = 0.65
- budgetScore = 1.0
- seasonScore = 1.0

### Step A6 - weighted total with budget_focus

Formula used:
- total = brand*0.10 + scent*0.10 + budget*0.50 + season*0.10

Candidate 1
- total = 1.0*0.10 + 0.533*0.10 + 1.0*0.50 + 1.0*0.10
- total = 0.7533
- public score ~ 75

Candidate 2
- total = 1.0*0.10 + 0.767*0.10 + 0.5*0.50 + 0.5*0.10
- total = 0.4767
- public score ~ 48

Candidate 3
- total = 0.3*0.10 + 0.65*0.10 + 1.0*0.50 + 1.0*0.10
- total = 0.695
- public score ~ 70

Rank result
1) Dior Fresh Citrus EDT (75)
2) Local Citrus Sport (70)
3) Chanel Amber Night (48)

Because ChatV9 requests size=1, RecommendationV3 returns only top 1.

### Step A7 - injection and final AI response

- System injects RECOMMENDATION_RESULTS payload.
- Final AI generation builds human-friendly answer message and suggested questions.
- If productTemp returned, service hydrates full products.

Example final assistant behavior
- Message: concise personalized recommendation explanation.
- Products: includes selected product card and chosen variant.
- suggestedQuestions: follow-up prompts for user.

---

## 7) Worked Example B (Search/Consult branch)

User message
- "Cho toi xem chai Dior duoi 1 trieu"

Flow
1) intent = Search (or Consult)
2) ProductService.getProductsUsingParsedSearch called
3) SEARCH_RESULTS injected to AI context
4) AI generates structured response with product suggestions
5) hydration may further align products by IDs

Key difference from Recommend
- Does not call RecommendationV3 scoring pipeline.
- Focuses on search retrieval semantics.

---

## 8) Worked Example C (Pure Chat branch)

User message
- "Ban co the giai thich su khac nhau giua EDT va EDP khong?"

Flow
1) intent likely Chat/Consult depending analyzer
2) If not routed to search/recommend, no tool-result injection
3) AI answers from system prompt and chat context
4) Returns message + suggestedQuestions, products may be null

---

## 9) How products are actually decided (core clarification)

Many people assume weight values change SQL filtering directly. In this V3 design, that is not true.

Decision is two-stage:

Stage 1: Retrieve candidates from DB
- Based mostly on brand match and fallback broad fetch.
- Produces candidate pool.

Stage 2: Rank candidates in memory
- apply component scores
- apply active weights
- sort and choose top N

Therefore:
- SQL determines who enters the race.
- Weights determine who wins the race.

---

## 10) Traceability and Debug Checklist

The trace file logs/ai_recommendation_trace.txt contains useful tags:

- [REQ_ID]
- [USER_MESSAGE]
- [AI_ANALYSIS_INTENT]
- [NLP_EXTRACTED_KEYWORDS]
- [RECOMMEND_INPUT]
- [RECOMMEND_DYNAMIC_WEIGHTS]
- [RECOMMEND_PROFILE_USED]
- [RECOMMEND_PROFILE_PREFS]
- [RECOMMEND_SYSTEM_RESULT]
- [AI_FINAL_RECOMMEND_REASONING]
- [AI_FINAL_MESSAGE]

Use this order to debug one request:

1. Confirm correct intent.
2. Confirm expected keywords extracted.
3. Confirm dynamic mode and weights.
4. Confirm profile (brands/scents/budget).
5. Confirm recommendation rank and breakdown.
6. Confirm final generated message and product reasoning.

---

## 11) Current Limitations and Extension Notes

### 11.1 Survey and age weights are placeholders in V3 formula

- score formula currently uses only:
  - brand
  - scent
  - budget
  - season
- survey and age are not yet multiplied into totalScore.

### 11.2 chatContext currently passed but not consumed in V3 scoring

- pseudoChatContext is prepared in ChatV9.
- RecommendationV3 signature accepts chatContext.
- Current implementation does not use it in candidate query or score logic.

### 11.3 Candidate query favors brand strongly

- Scents are evaluated in scoring stage, not strongly constrained in SQL.
- Could be extended with note/family prefilter for larger catalogs.

### 11.4 Fallback currently returns empty list

- getFallbackRecommendations currently returns no products.
- Could be upgraded to bestseller/popular fallback.

---

## 12) Quick Reference: Where each key behavior lives

- ChatV9 endpoint
  - src/api/controllers/conversation.controller.ts
- ChatV9 orchestration
  - src/infrastructure/domain/conversation/conversation-v9.service.ts
- Intent-only AI analysis
  - src/infrastructure/domain/ai/ai-analysis.service.ts
- NLP parse and normalization
  - src/infrastructure/domain/common/nlp-engine.service.ts
- Recommendation V3 algorithm
  - src/infrastructure/domain/recommendation/recommendation-v3.service.ts
- Recommendation weights and types
  - src/infrastructure/domain/recommendation/recommendation-profile.type.ts
- Output schemas (conversation/product temp)
  - src/chatbot/output/search.output.ts
  - src/chatbot/output/product.output.ts
- Async conversation persistence worker
  - src/infrastructure/domain/processor/conversation.processor.ts
- Queue/job names
  - src/application/constant/processor.ts

---

## 13) Final Summary

From ChatV9 to RecommendationV3, the system follows a clear retrieve-then-rank strategy:

1) Understand user intent and extract keywords.
2) Route to correct branch.
3) For Recommend: build profile from real delivered orders.
4) Retrieve candidate pool from DB.
5) Compute multi-factor score and apply dynamic business weights.
6) Pick top ranked items.
7) Inject structured tool output to final AI message generation.
8) Hydrate final product details.
9) Persist conversation asynchronously via queue.

This architecture balances speed, explainability, and extensibility, while keeping V3 practical and easy to maintain.
