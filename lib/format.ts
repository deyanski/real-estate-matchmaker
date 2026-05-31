export function formatEUR(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2
  }).format(price);
}
