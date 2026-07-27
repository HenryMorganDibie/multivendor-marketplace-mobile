export const FLOATING_TAB_BAR_HEIGHT = 56;

export const SCREEN_BOTTOM_PADDING = 20;

export function getBottomOverlayPadding(bottomInset: number): number {
  return FLOATING_TAB_BAR_HEIGHT + Math.max(bottomInset, 8) + SCREEN_BOTTOM_PADDING;
}
