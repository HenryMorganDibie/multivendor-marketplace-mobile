export function formatRequestedDateTime(
  fulfillmentDate?: string,
  fulfillmentTime?: string,
  scheduledDate?: string,
  scheduledTime?: string,
  isExternalOrder?: boolean
): string | null {
  if (isExternalOrder && fulfillmentDate) {
    const date = new Date(fulfillmentDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    let dateLabel = '';
    if (isToday) {
      dateLabel = 'Today';
    } else if (isTomorrow) {
      dateLabel = 'Tomorrow';
    } else {
      dateLabel = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    if (fulfillmentTime) {
      return `${dateLabel} • ${fulfillmentTime}`;
    }
    return dateLabel;
  }

  if (!scheduledDate && !scheduledTime) return null;

  if (scheduledDate && scheduledTime) {
    const date = new Date(scheduledDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${formattedDate} • ${scheduledTime}`;
  }

  if (scheduledDate) {
    const date = new Date(scheduledDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  return scheduledTime || null;
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return 'Today';
  if (isTomorrow) return 'Tomorrow';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatPaymentHistoryTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
