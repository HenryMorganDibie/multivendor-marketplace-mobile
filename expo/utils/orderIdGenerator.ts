export function generatePlatformOrderId(vendorSlug: string): string {
  const randomDigits = Math.floor(Math.random() * 90000000) + 10000000;
  return `${vendorSlug.toLowerCase()}-${randomDigits}`;
}
