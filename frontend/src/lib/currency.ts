// Currency conversion and formatting utilities

export const USD_TO_INR_RATE = 83; // Approximate conversion rate

/**
 * Convert USD to INR
 */
export function convertUsdToInr(usdAmount: number): number {
  return Math.round(usdAmount * USD_TO_INR_RATE);
}

/**
 * Format currency in INR
 */
export function formatInr(amount: number): string {
  if (amount === 0) return "Free";
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Format price display (handles conversion from USD if needed)
 */
export function formatPrice(priceInInr: number): string {
  return formatInr(priceInInr);
}

/**
 * Convert and format USD price to INR
 */
export function formatUsdToInr(usdPrice: number): string {
  const inrPrice = convertUsdToInr(usdPrice);
  return formatInr(inrPrice);
}
