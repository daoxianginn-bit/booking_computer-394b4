// ============================================================================
// 本地儲存層：取代原本的 Supabase，資料全部存在瀏覽器 localStorage。
// 不需要登入、不需要後端，開啟頁面就能用；缺點是資料只存在這台裝置/這個瀏覽器，
// 所以畫面上提供「匯出/匯入 JSON」做備份與跨裝置搬移。
// ============================================================================

import type {
  RoomType,
  RoomPricing,
  RoomExtraPersonPricing,
  WholeHousePackage,
  WholeHousePackagePricing,
  ExtraPersonRule,
  DateRange,
  Promotion,
} from './bookingEngine';

export interface BookingSettings {
  wholeHouseEnabled: boolean;
  discountCleaning: number;
  discountNoCleaning: number;
  consecutiveStayDefaultOption: 'cleaning' | 'no_cleaning';
  peakSeasonWeekdayTier: 'peak' | 'weekday';
}

export interface BookingData {
  settings: BookingSettings;
  roomTypes: RoomType[];
  roomPricing: RoomPricing[];
  roomExtraPersonPricing: RoomExtraPersonPricing[];
  packages: WholeHousePackage[];
  packagePricing: WholeHousePackagePricing[];
  packageRooms: { id: string; package_id: string; room_type_id: string }[];
  extraRules: (ExtraPersonRule & { id: string })[];
  dateRanges: (DateRange & { id: string })[];
  promotions: Promotion[];
}

const STORAGE_KEY = 'booking_computer_data_v1';

export const DEFAULT_SETTINGS: BookingSettings = {
  wholeHouseEnabled: true,
  discountCleaning: 0,
  discountNoCleaning: 0,
  consecutiveStayDefaultOption: 'no_cleaning',
  peakSeasonWeekdayTier: 'peak',
};

export const EMPTY_DATA: BookingData = {
  settings: DEFAULT_SETTINGS,
  roomTypes: [],
  roomPricing: [],
  roomExtraPersonPricing: [],
  packages: [],
  packagePricing: [],
  packageRooms: [],
  extraRules: [],
  dateRanges: [],
  promotions: [],
};

export function loadData(): BookingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_DATA);
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      roomTypes: parsed.roomTypes ?? [],
      roomPricing: parsed.roomPricing ?? [],
      roomExtraPersonPricing: parsed.roomExtraPersonPricing ?? [],
      packages: parsed.packages ?? [],
      packagePricing: parsed.packagePricing ?? [],
      packageRooms: parsed.packageRooms ?? [],
      extraRules: parsed.extraRules ?? [],
      dateRanges: parsed.dateRanges ?? [],
      promotions: parsed.promotions ?? [],
    };
  } catch {
    return structuredClone(EMPTY_DATA);
  }
}

export function saveData(data: BookingData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportDataAsFile(data: BookingData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `訂房計算機設定_${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedFile(text: string): BookingData {
  const parsed = JSON.parse(text);
  return {
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    roomTypes: parsed.roomTypes ?? [],
    roomPricing: parsed.roomPricing ?? [],
    roomExtraPersonPricing: parsed.roomExtraPersonPricing ?? [],
    packages: parsed.packages ?? [],
    packagePricing: parsed.packagePricing ?? [],
    packageRooms: parsed.packageRooms ?? [],
    extraRules: parsed.extraRules ?? [],
    dateRanges: parsed.dateRanges ?? [],
    promotions: parsed.promotions ?? [],
  };
}
