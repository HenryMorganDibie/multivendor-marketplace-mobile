import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

export const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
} as const;

export const LAYOUT = {
  phoneHorizontalPadding: 20,
  tabletHorizontalPadding: 40,
  phoneContentMaxWidth: 600,
  tabletContentMaxWidth: 960,
  phoneCardWidth: 280,
  tabletCardWidth: 320,
  phoneGridColumns: 1,
  tabletGridColumns: 2,
  phoneCatalogColumns: 2,
  tabletCatalogColumns: 3,
  sectionGap: 16,
  cardGap: 16,
  tabletCardGap: 20,
} as const;

export function isTablet(width: number): boolean {
  return width >= BREAKPOINTS.tablet;
}

export function getHorizontalPadding(width: number): number {
  return isTablet(width) ? LAYOUT.tabletHorizontalPadding : LAYOUT.phoneHorizontalPadding;
}

export function getGridColumns(width: number): number {
  if (width >= 1024) return 3;
  if (width >= BREAKPOINTS.tablet) return 2;
  return 1;
}

export function getCatalogColumns(width: number): number {
  if (width >= 1024) return 4;
  if (width >= BREAKPOINTS.tablet) return 3;
  return 2;
}

export function getCardWidth(width: number): number {
  return isTablet(width) ? LAYOUT.tabletCardWidth : LAYOUT.phoneCardWidth;
}

export function getCardGap(width: number): number {
  return isTablet(width) ? LAYOUT.tabletCardGap : LAYOUT.cardGap;
}

export function getContentMaxWidth(width: number): number {
  return isTablet(width) ? LAYOUT.tabletContentMaxWidth : LAYOUT.phoneContentMaxWidth;
}

export interface ResponsiveLayout {
  width: number;
  isTablet: boolean;
  horizontalPadding: number;
  gridColumns: number;
  catalogColumns: number;
  cardWidth: number;
  cardGap: number;
  contentMaxWidth: number;
  cardContainerWidth: (columns: number, gap: number, padding: number) => number;
}

export function useResponsive(): ResponsiveLayout {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const tablet = isTablet(width);
    const hPad = getHorizontalPadding(width);
    const cols = getGridColumns(width);
    const catCols = getCatalogColumns(width);
    const cw = getCardWidth(width);
    const gap = getCardGap(width);
    const maxW = getContentMaxWidth(width);

    const cardContainerWidth = (columns: number, gapSize: number, padding: number): number => {
      return (width - padding * 2 - gapSize * (columns - 1)) / columns;
    };

    return {
      width,
      isTablet: tablet,
      horizontalPadding: hPad,
      gridColumns: cols,
      catalogColumns: catCols,
      cardWidth: cw,
      cardGap: gap,
      contentMaxWidth: maxW,
      cardContainerWidth,
    };
  }, [width]);
}
