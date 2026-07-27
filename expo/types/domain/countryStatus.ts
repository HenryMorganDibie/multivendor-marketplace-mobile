/**
 * Country rollout status — single source of truth.
 *
 * The canonical union and the supporting config/info interfaces live in
 * `utils/countryStatus` (alongside the runtime lookup map) and are re-exported
 * here so `@/types/domain` stays the one import surface for types.
 */
export type {
  CountryStatus,
  CountryStatusInfo,
  CountryStatusConfig,
} from '@/utils/countryStatus';
