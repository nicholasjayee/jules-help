/**
 * Utility functions for batching Supabase queries to avoid hitting the 1000 row limit
 */

import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export const BATCH_SIZE = 1000;

/**
 * Fetches all records from a Supabase query by batching requests
 * @param query - The Supabase query builder (already filtered, ordered, etc)
 * @param batchSize - Number of rows per batch (default: 1000)
 * @returns Promise with all fetched data
 */
export async function fetchAllBatched<T>(
  queryBuilder: any,
  batchSize: number = BATCH_SIZE
): Promise<T[]> {
  const allData: T[] = [];
  let start = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: chunk, error } = await queryBuilder
      .range(start, start + batchSize - 1);

    if (error) throw error;

    if (chunk && chunk.length > 0) {
      allData.push(...chunk);
      hasMore = chunk.length === batchSize;
      start += batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

/**
 * Fetches all records with count
 */
export async function fetchAllBatchedWithCount<T>(
  queryBuilder: any,
  batchSize: number = BATCH_SIZE
): Promise<{ data: T[]; count: number }> {
  const allData: T[] = [];
  let start = 0;
  let hasMore = true;
  let totalCount = 0;

  // First request gets the count
  const { data: firstChunk, error: firstError, count } = await queryBuilder
    .range(start, start + batchSize - 1);

  if (firstError) throw firstError;

  totalCount = count || 0;

  if (firstChunk && firstChunk.length > 0) {
    allData.push(...firstChunk);
    hasMore = firstChunk.length === batchSize;
    start += batchSize;
  } else {
    hasMore = false;
  }

  // Continue fetching remaining batches
  while (hasMore) {
    const { data: chunk, error } = await queryBuilder
      .range(start, start + batchSize - 1);

    if (error) throw error;

    if (chunk && chunk.length > 0) {
      allData.push(...chunk);
      hasMore = chunk.length === batchSize;
      start += batchSize;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, count: totalCount };
}

/**
 * Processes data in batches (for operations like bulk updates)
 */
export async function processBatched<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R>,
  batchSize: number = BATCH_SIZE
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await processor(batch);
    results.push(result);
  }

  return results;
}
