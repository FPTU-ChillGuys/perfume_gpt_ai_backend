import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const BASE_URL = process.env.SEARCH_V4_BASE_URL ?? 'http://localhost:3000';
const INPUT_FILE = process.env.SEARCH_V4_INPUT ?? path.join(process.cwd(), 'temp', 'test_queries_v4.txt');
const OUTPUT_FILE = process.env.SEARCH_V4_OUTPUT ?? path.join(process.cwd(), 'temp', 'search_v4_results.txt');
const PAGE_NUMBER = Number(process.env.SEARCH_V4_PAGE ?? 1);
const PAGE_SIZE = Number(process.env.SEARCH_V4_PAGE_SIZE ?? 10);

type SearchV4Response = {
  success: boolean;
  payload?: {
    items?: Array<{
      id?: string;
      name?: string;
      brandName?: string;
      categoryName?: string;
      similarity?: number;
    }>;
    totalCount?: number;
    queryFilters?: any;
    vectorSimilarity?: boolean;
  };
};

async function callSearchV4(query: string): Promise<SearchV4Response> {
  const url = `${BASE_URL}/products/search/v4`;
  const response = await axios.get(url, {
    params: {
      searchText: query,
      PageNumber: PAGE_NUMBER,
      PageSize: PAGE_SIZE,
    },
    timeout: 30000,
  });

  return response.data;
}

function parseQueries(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

function shortJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

async function main() {
  const fileContent = await fs.readFile(INPUT_FILE, 'utf-8');
  const queries = parseQueries(fileContent);

  const lines: string[] = [];
  lines.push('# search/v4 test report');
  lines.push(`# generatedAt: ${new Date().toISOString()}`);
  lines.push(`# baseUrl: ${BASE_URL}`);
  lines.push(`# totalQueries: ${queries.length}`);
  lines.push('');

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    lines.push(`## [${i + 1}] ${q}`);

    try {
      const data = await callSearchV4(q);
      const payload = data.payload ?? {};
      const items = payload.items ?? [];
      const totalCount = payload.totalCount ?? 0;
      const top3 = items.slice(0, 3).map(item => ({
        name: item.name,
        brandName: item.brandName,
        similarity: item.similarity
      }));

      successCount++;
      successCount += data.success ? 1 : 0;

      lines.push(`success: ${data.success}`);
      lines.push(`totalCount: ${totalCount}`);
      lines.push(`vectorSimilarity: ${payload.vectorSimilarity}`);
      lines.push(`queryFilters: ${shortJson(payload.queryFilters)}`);
      lines.push('top3 (quick check):');
      lines.push(shortJson(top3));
    } catch (error: any) {
      failedCount++;
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
  lines.push(`# Summary: ${successCount} success, ${failedCount} failed`);
  lines.push(`# generatedAt: ${new Date().toISOString()}`);

  await fs.writeFile(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`Test completed. Results saved to ${OUTPUT_FILE}`);
  console.log(`Summary: ${successCount} success, ${failedCount} failed`);
}

main().catch(err => {
  console.error('Failed to run search/v4 test script:', err);
  process.exit(1);
});
