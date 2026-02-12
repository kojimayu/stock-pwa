import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * 検索用の文字列正規化（全画面共通）
 * - 全角英数記号 → 半角英数記号
 * - 大文字 → 小文字
 * - 前後の空白を除去
 */
export function normalizeForSearch(str: string): string {
  if (!str) return "";
  return str
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[-\s　]/g, "")  // Remove hyphens, half/full-width spaces
    .toLowerCase();
}
