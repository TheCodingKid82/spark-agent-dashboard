/**
 * Database utility for SQL queries
 * Uses pg Pool with tagged template support
 */

import { Pool, QueryResultRow } from 'pg';

// Create pool if DATABASE_URL is available
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

/**
 * Tagged template SQL function
 * Usage: sql`SELECT * FROM table WHERE id = ${id}`
 */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  if (!pool) {
    console.warn('DATABASE_URL not set, returning empty array');
    return [];
  }

  // Build parameterized query
  let query = '';
  const params: unknown[] = [];
  
  strings.forEach((str, i) => {
    query += str;
    if (i < values.length) {
      params.push(values[i]);
      query += `$${params.length}`;
    }
  });

  try {
    const result = await pool.query<T>(query, params);
    return result.rows;
  } catch (error) {
    console.error('SQL error:', error);
    throw error;
  }
}

/**
 * Raw query function for complex queries
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  if (!pool) {
    console.warn('DATABASE_URL not set, returning empty array');
    return [];
  }

  try {
    const result = await pool.query<T>(text, params);
    return result.rows;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

export { pool };
