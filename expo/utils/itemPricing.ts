import type { MenuItem } from '@/mocks/vendorData';
import type { CatalogItem } from '@/contexts/CatalogContext';

export function getMenuItemDisplayPrice(item: MenuItem): number {
  return item.salePrice ?? item.price;
}

export function getCatalogItemDisplayPrice(item: CatalogItem): number {
  return item.salePrice ?? item.basePrice;
}

export function getItemDisplayPrice(
  menuItem: MenuItem | undefined,
  catalogItem: CatalogItem | undefined
): number {
  if (catalogItem) {
    return catalogItem.salePrice ?? catalogItem.basePrice;
  }
  if (menuItem) {
    return menuItem.salePrice ?? menuItem.price;
  }
  return 0;
}

export function getItemBasePrice(
  menuItem: MenuItem | undefined,
  catalogItem: CatalogItem | undefined
): number {
  if (catalogItem) {
    return catalogItem.basePrice;
  }
  if (menuItem) {
    return menuItem.price;
  }
  return 0;
}

export function hasItemSalePrice(
  menuItem: MenuItem | undefined,
  catalogItem: CatalogItem | undefined
): boolean {
  if (catalogItem) {
    return (
      catalogItem.salePrice !== undefined &&
      catalogItem.salePrice > 0 &&
      catalogItem.salePrice < catalogItem.basePrice
    );
  }
  if (menuItem) {
    return (
      menuItem.salePrice !== undefined &&
      menuItem.salePrice > 0 &&
      menuItem.salePrice < menuItem.price
    );
  }
  return false;
}
