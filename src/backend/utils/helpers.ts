import mongoose from "mongoose";
import { normalizeCurrency } from "./currency";

/**
 * Check if a string is a valid MongoDB ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Convert string to ObjectId
 */
export function toObjectId(id: string): mongoose.Types.ObjectId {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  return new mongoose.Types.ObjectId(id);
}

/**
 * Safely convert to ObjectId, returns null if invalid
 */
export function safeToObjectId(id: string): mongoose.Types.ObjectId | null {
  return isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
}

/**
 * Get current month and year for budget queries
 */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // JavaScript months are 0-indexed
    year: now.getFullYear(),
  };
}

/**
 * Get date range for a specific month and year
 */
export function getMonthDateRange(month: number, year: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Format currency amount
 */
export function formatAmount(
  amount: number,
  currency: string | { code?: string; symbol?: string; name?: string } = "BDT",
): string {
  const normalized = normalizeCurrency(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalized.code,
  }).format(amount);
}

/**
 * Calculate total from array of objects with amount property
 */
export function calculateTotal<T extends { amount: number }>(items: T[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

/**
 * Group transactions by category
 */
export function groupByCategory<T extends { categoryId?: mongoose.Types.ObjectId; amount: number }>(
  items: T[]
): Map<string, number> {
  const grouped = new Map<string, number>();
  
  items.forEach((item) => {
    const categoryId = item.categoryId?.toString() || "uncategorized";
    const current = grouped.get(categoryId) || 0;
    grouped.set(categoryId, current + item.amount);
  });
  
  return grouped;
}

/**
 * Check if date is within current month
 */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/**
 * Paginate query results
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginate<T>(
  allData: T[],
  options: PaginationOptions = {}
): PaginationResult<T> {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const total = allData.length;
  const totalPages = Math.ceil(total / limit);
  
  const start = (page - 1) * limit;
  const end = start + limit;
  const data = allData.slice(start, end);
  
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasMore: end < total,
  };
}
