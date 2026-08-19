/**
 * ServiceCentric Shared Utilities — Currency & Finance
 * Standardized INR currency formatting, compact currency display, and GST calculations.
 */

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  if (Math.abs(amount) >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  if (Math.abs(amount) >= 1000) {
    return `₹${(amount / 1000).toFixed(1)} k`;
  }
  return formatINR(amount);
}

export function calculateGST(baseAmount: number, ratePercent: number = 18): { baseAmount: number; gstAmount: number; totalAmount: number } {
  const gstAmount = (baseAmount * ratePercent) / 100;
  return {
    baseAmount,
    gstAmount,
    totalAmount: baseAmount + gstAmount,
  };
}
