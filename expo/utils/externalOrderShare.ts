export function generateExternalOrderId(vendorSlug: string): string {
  const randomDigits = Math.floor(Math.random() * 900000) + 100000;
  return `${vendorSlug.toUpperCase()}-EXT-${randomDigits}`;
}

export function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function buildShareUrl(externalOrderId: string, shareToken: string): string {
  return `https://the platform.com/order/ext/${externalOrderId}?token=${shareToken}`;
}

export function buildShareMessage(
  vendorName: string,
  externalOrderId: string,
  shareToken: string,
  total: string,
): string {
  const url = buildShareUrl(externalOrderId, shareToken);
  return `Hi! Here's your order summary from ${vendorName}.\n\nOrder: ${externalOrderId}\nTotal: ${total}\n\nView details: ${url}`;
}

export function buildDetailedShareMessage(
  vendorName: string,
  orderId: string,
  total: string,
  fulfillmentTime: string,
  externalOrderId: string,
  shareToken: string,
): string {
  const url = buildShareUrl(externalOrderId, shareToken);
  return `Hi! Here are your order details from ${vendorName}.\n\nOrder ID: ${orderId}\nTotal: ${total}\nPickup Time: ${fulfillmentTime}\n\nView your order here:\n${url}`;
}
