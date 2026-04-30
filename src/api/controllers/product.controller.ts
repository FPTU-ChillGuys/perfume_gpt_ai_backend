import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseUUIDPipe, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/application/common/Metadata';
import { PagedAndSortedRequest } from 'src/application/dtos/request/paged-and-sorted.request';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { ProductResponse } from 'src/application/dtos/response/product.response';
import { ProductWithVariantsResponse } from 'src/application/dtos/response/product-with-variants.response';
import { BestSellingProductResponse } from 'src/application/dtos/response/product-insight.response';
import { VariantSalesAnalyticsResponse } from 'src/application/dtos/response/variant-sales-analytics.response';
import { ProductService } from 'src/infrastructure/domain/product/product.service';
import { AiAnalysisService } from 'src/infrastructure/domain/ai/ai-analysis.service';
import { RestockService } from 'src/infrastructure/domain/restock/restock.service';
import { ExtendApiBaseResponse } from 'src/infrastructure/domain/utils/api-response-decorator';
import { UserLogService } from 'src/infrastructure/domain/user-log/user-log.service';
import { HybridSearchService } from 'src/infrastructure/domain/hybrid-search/hybrid-search.service';
import { HybridSearchResponse } from 'src/application/dtos/response/hybrid-search/hybrid-search.response';
import { Request } from 'express';
import { resolveLogUserIdFromRequest } from 'src/infrastructure/domain/utils/extract-token';
import { SearchRequest } from 'src/application/dtos/request/search.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { ProductViewLogRequest, SearchTextLogRequest } from 'src/application/dtos/request/product-log.request';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);
  constructor(
    private productService: ProductService,
    private userLog: UserLogService,
    private aiAnalysisService: AiAnalysisService,
    private hybridSearchService: HybridSearchService
  ) { }

  /** Lấy danh sách tất cả sản phẩm */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả sản phẩm' })
  @ExtendApiBaseResponse(PagedResult, ProductResponse)
  async getAllProducts(@Query() request: PagedAndSortedRequest): Promise<BaseResponseAPI<PagedResult<ProductResponse>>> {
    return this.productService.getAllProducts(request);
  }

  /** Tìm kiếm sản phẩm bằng semantic search */
  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng semantic search' })
  @ExtendApiBaseResponse(PagedResult, ProductWithVariantsResponse)
  async getProductsBySemanticSearch(@Req() req: Request, @Query() request: SearchRequest): Promise<BaseResponseAPI<PagedResult<ProductWithVariantsResponse>>> {
    const result = await this.productService.getProductsUsingSemanticSearch(request.searchText, request);
    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, request.searchText);
    return result;
  }

  /** [TEST] Lấy danh sách sản phẩm kèm toàn bộ variants (phân trang) */
  @Public()
  @Get('all/with-variants')
  @ApiOperation({ summary: '[TEST] Lấy danh sách sản phẩm kèm toàn bộ variants' })
  @ExtendApiBaseResponse(PagedResult, ProductWithVariantsResponse)
  async getAllProductsWithVariants(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    return this.productService.getAllProductsWithVariants(request);
  }

  /** [TEST] Lấy danh sách sản phẩm mới nhất */
  @Public()
  @Get('all/newest')
  @ApiOperation({ summary: '[TEST] Lấy danh sách sản phẩm mới nhất' })
  @ExtendApiBaseResponse(PagedResult, ProductWithVariantsResponse)
  async getNewestProductsWithVariants(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    return this.productService.getNewestProductsWithVariants(request);
  }

  /** [TEST] Lấy danh sách sản phẩm bán chạy */
  @Public()
  @Get('all/best-sellers')
  @ApiOperation({ summary: '[TEST] Lấy danh sách sản phẩm bán chạy' })
  @ExtendApiBaseResponse(PagedResult, BestSellingProductResponse)
  async getBestSellingProducts(
    @Query() request: PagedAndSortedRequest
  ): Promise<BaseResponse<PagedResult<BestSellingProductResponse>>> {
    return this.productService.getBestSellingProducts(request);
  }

  /** Tìm kiếm sản phẩm bằng semantic search, trả về kèm toàn bộ variants */
  @Public()
  @Get('search/with-variants')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng semantic search, kết quả kèm toàn bộ variants' })
  @ExtendApiBaseResponse(PagedResult, ProductWithVariantsResponse)
  async getProductsBySemanticSearchWithVariants(
    @Req() req: Request,
    @Query() request: SearchRequest
  ): Promise<BaseResponse<PagedResult<ProductWithVariantsResponse>>> {
    const result = await this.productService.getProductsUsingSemanticSearchWithVariants(
      request.searchText,
      request
    );
    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, request.searchText);
    return result;
  }

  /** Tìm kiếm sản phẩm bằng semantic search v2 (AI extraction) */
  @Public()
  @Get('search/v2')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng semantic search v2 (AI extraction)' })
  @ExtendApiBaseResponse(PagedResult, ProductWithVariantsResponse)
  async getProductsByAiSearch(
    @Req() req: Request,
    @Query() request: SearchRequest
  ): Promise<BaseResponseAPI<any>> {
    const isSemanticOnly = process.env.SEARCH_SEMANTIC_ONLY === 'true';
    
    if (isSemanticOnly) {
      this.logger.log(`[SEARCH][V2] Semantic Only mode enabled. Redirecting to Hybrid Search v4 for text: "${request.searchText}"`);
      const result = await this.hybridSearchService.search(request.searchText, request);
      return result;
    }

    const analysis = await this.aiAnalysisService.analyze(request.searchText);

    this.logger.log(`Analysis: ${JSON.stringify(analysis)}`);

    const result = analysis
      ? await this.productService.getProductsByStructuredQuery(analysis)
      : await this.productService.getAllProductsWithVariants(request);

    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, request.searchText);

    return {
      success: true,
      payload: result.data
    };
  }

  /** Tìm kiếm sản phẩm bằng parser path (winkNLP parse -> query builder) để kiểm chứng */
  @Public()
  @Get('search/v3')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm bằng parser path (parse -> query)' })
  @ExtendApiBaseResponse(PagedResult, ProductWithVariantsResponse)
  async getProductsByParsedSearch(
    @Req() req: Request,
    @Query() request: SearchRequest
  ): Promise<BaseResponseAPI<any>> {
    const result = await this.productService.getProductsUsingParsedSearch(request.searchText, request);

    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, request.searchText);

    return result;
  }

  /** Hybrid Search v4 - Query Layer + Vector Layer */
  @Public()
  @Get('search/v4')
  @ApiOperation({ summary: 'Hybrid Search v4 - Kết hợp Query Layer (hard filters) và Vector Layer (similarity)' })
  @ExtendApiBaseResponse(HybridSearchResponse)
  async getProductsByHybridSearch(
    @Req() req: Request,
    @Query() request: SearchRequest
  ): Promise<BaseResponseAPI<HybridSearchResponse>> {
    const result = await this.hybridSearchService.search(request.searchText, request);

    const logUserId = resolveLogUserIdFromRequest(req);
    await this.userLog.addSearchLogToUserLog(logUserId, request.searchText);

    return result;
  }

  /** [TEST] Lấy chi tiết một sản phẩm kèm toàn bộ variants */
  @Public()
  @Get(':id/with-variants')
  @ApiOperation({ summary: '[TEST] Lấy chi tiết sản phẩm kèm toàn bộ variants' })
  @ApiParam({ name: 'id', description: 'UUID của sản phẩm', format: 'uuid' })
  @ExtendApiBaseResponse(ProductWithVariantsResponse)
  async getProductWithVariants(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ): Promise<BaseResponse<ProductWithVariantsResponse>> {
    return this.productService.getProductWithVariants(id);
  }

  /** Ghi log khi người dùng click vào một sản phẩm hoặc variant */
  @Public()
  @Post('log/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi log khi người dùng xem / click vào product hoặc variant' })
  async logProductView(
    @Req() req: Request,
    @Body() body: ProductViewLogRequest
  ): Promise<BaseResponse<{ id: string }>> {
    const rawUserId = body.userId || resolveLogUserIdFromRequest(req);
    const userId = rawUserId.toLowerCase();
    
    if (userId.startsWith('anonymous:')) {
      this.logger.warn(
        `[PRODUCT-LOG] logProductView is using anonymous userId. Pass body.userId or Bearer token for personalized recommendation.`
      );
    }
    this.logger.log(
      `[PRODUCT-LOG] logProductView userId=${userId}, productId=${body.productId}, variantId=${body.variantId || 'n/a'}`
    );

    const viewInfo = await this.productService.resolveProductViewInfo(
      body.productId,
      body.variantId
    );
    const id = await this.userLog.addProductViewLog(
      userId,
      body.productId,
      body.variantId,
      viewInfo.productName,
      viewInfo.variantName,
      {
        brand: viewInfo.brand,
        category: viewInfo.category,
        gender: viewInfo.gender,
        scentNotes: viewInfo.scentNotes,
        olfactoryFamilies: viewInfo.olfactoryFamilies,
        basePrice: viewInfo.basePrice
      }
    );
    return { success: true, data: { id } };
  }

  /** Ghi log từ khóa tìm kiếm (chỉ log, không thực hiện tìm kiếm) */
  @Public()
  @Post('log/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi log từ khóa tìm kiếm (không thực hiện tìm kiếm)' })
  async logSearchText(
    @Req() req: Request,
    @Body() body: SearchTextLogRequest
  ): Promise<BaseResponse<{ id: string }>> {
    const rawUserId = body.userId || resolveLogUserIdFromRequest(req);
    const userId = rawUserId.toLowerCase();
    
    if (userId.startsWith('anonymous:')) {
      this.logger.warn(
        `[PRODUCT-LOG] logSearchText is using anonymous userId. Pass body.userId or Bearer token for personalized recommendation.`
      );
    }
    this.logger.log(
      `[PRODUCT-LOG] logSearchText userId=${userId}, searchText=${body.searchText}`
    );

    const id = await this.userLog.addSearchTextLog(userId, body.searchText);
    return { success: true, data: { id } };
  }

  }
