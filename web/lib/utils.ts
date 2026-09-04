import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function humanizeNumber(num: number): string {
  if (num >= 10000) {
    return `${Math.floor(num / 1000)}k`;
  }
  if (num >= 1000) {
    const decimal = Math.floor((num % 1000) / 100);
    return decimal === 0 ? `${Math.floor(num / 1000)}k` : `${Math.floor(num / 1000)}.${decimal}k`;
  }
  return `${num}`;
}
