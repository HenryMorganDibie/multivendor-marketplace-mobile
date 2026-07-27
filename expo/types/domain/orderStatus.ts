/**
 * Order progress status — single source of truth.
 *
 * The canonical union and all label/color helpers live in
 * `constants/orderStatus`. This re-export keeps `@/types/domain` as the one
 * import surface for types while leaving the runtime helpers in constants.
 */
export type { OrderStatus } from '@/constants/orderStatus';
