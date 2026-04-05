import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const BASE_URL = process.env.SEARCH_V3_BASE_URL ?? 'http://localhost:3000';
const INPUT_FILE = process.env.SEARCH_V3_INPUT ?? path.join(process.cwd(), 'temp', 'test_queries_v3.txt');
const OUTPUT_FILE = process.env.SEARCH_V3_OUTPUT ?? path.join(process.cwd(), 'temp', 'search_v3_results.txt');
const PAGE_NUMBER = Number(process.env.SEARCH_V3_PAGE ?? 1);
const PAGE_SIZE = Number(process.env.SEARCH_V3_PAGE_SIZE ?? 10);

type SearchV3Response = {
  success: boolean;
  payload?: {
    items?: Array<{
      id?: string;
      name?: string;
      brandName?: string;
      categoryName?: string;
    }>;
    totalCount?: number;
    extractedObject?: {
      logic?: string[][];
      productNames?: string[];
      budget?: Record<string, unknown>;
    };
    queryLogicUsed?: string[][];
    parsedResult?: {
      byType?: Record<string, string[]>;
      signals?: Record<string, unknown>;
      logic?: Record<string, unknown>;
    };
  };
};

function parseQueries(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

function shortJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

async function callSearchV3(query: string): Promise<SearchV3Response> {
  const url = `${BASE_URL}/products/search/v3`;
  const response = await axios.get<SearchV3Response>(url, {
    params: {
      searchText: query,
      PageNumber: PAGE_NUMBER,
      PageSize: PAGE_SIZE,
    },
    timeout: 30000,
  });

  return response.data;
}

async function main() {
  const fileContent = await fs.readFile(INPUT_FILE, 'utf-8');
  const queries = parseQueries(fileContent);

  const lines: string[] = [];
  lines.push('# search/v3 test report');
  lines.push(`# generatedAt: ${new Date().toISOString()}`);
  lines.push(`# baseUrl: ${BASE_URL}`);
  lines.push(`# totalQueries: ${queries.length}`);
  lines.push('');

  let successCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    lines.push(`## [${i + 1}] ${q}`);

    try {
      const data = await callSearchV3(q);
      const payload = data.payload ?? {};
      const items = payload.items ?? [];
      const totalCount = payload.totalCount ?? 0;
      const top3 = items.slice(0, 3).map(item => ({
        name: item.name,
        brandName: item.brandName,
        categoryName: item.categoryName,
      }));

      successCount += data.success ? 1 : 0;

      lines.push(`success: ${data.success}`);
      lines.push(`totalCount: ${totalCount}`);
      lines.push('top3 (quick check):');
      lines.push(shortJson(top3));
      lines.push('parsedResult:');
      lines.push(shortJson(payload.parsedResult));
      lines.push('parsed.byType:');
      lines.push(shortJson(payload.parsedResult?.byType));
      lines.push('parsed.signals:');
      lines.push(shortJson(payload.parsedResult?.signals));
      lines.push('queryLogicUsed:');
      lines.push(shortJson(payload.queryLogicUsed ?? payload.extractedObject?.logic));
    } catch (error: any) {
      lines.push('success: false');
      lines.push(`error: ${error?.message ?? 'unknown error'}`);
      if (error?.response?.status) {
        lines.push(`status: ${error.response.status}`);
      }
      if (error?.response?.data) {
        lines.push('errorResponse:');
        lines.push(shortJson(error.response.data));
      }
    }

    lines.push('');
  }

  lines.push('---');
  lines.push(`# successResponses: ${successCount}/${queries.length}`);

  await fs.writeFile(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`Report written: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Failed to run search/v3 test script:', err);
  process.exit(1);
});
