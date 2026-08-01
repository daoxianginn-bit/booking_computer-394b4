import { useState, useEffect } from 'react';
import { Plus, Trash2, Home, Users, Calculator, Save, Wand2, Download, Upload } from 'lucide-react';
import {
  suggestRoomCombo,
  getAvailableIndividualRooms,
  computeIndividualOptions,
  selectWholeHousePackage,
  selectWholeHouseUpgradeOption,
  compareOptions,
  computeMultiNightQuote,
  MultiNightQuoteResult,
} from '../lib/bookingEngine';
import { loadData, saveData, exportDataAsFile, parseImportedFile, BookingData } from '../lib/storage';

// 房型/包棟方案定價目前支援的 tier，對應 bookingEngine.resolvePricingTier() 實際會判斷出來的級距。
const PRICING_TIERS = ['平日', '小假日', '連假', '旺季', '定價'];
// 自動報價總表只顯示會被實際判斷出來的營運 tier（不含「定價」這種純參考價）。
const MATRIX_TIERS = ['平日', '小假日', '連假', '旺季'];
const RULE_TYPE_OPTIONS = [
  { value: 'no_extra_room', label: '不開房' },
  { value: 'extra_room', label: '開房' },
];

function newId(): string {
  return crypto.randomUUID();
}

function getTierPrice(list: any[], idField: string, idValue: string, tier: string): string {
  const found = list.find((p) => p[idField] === idValue && p.tier === tier);
  return found && found.price != null ? String(found.price) : '';
}

function setTierPrice(
  list: any[],
  setList: (v: any[]) => void,
  idField: string,
  idValue: string,
  tier: string,
  priceInput: string
) {
  const price = priceInput === '' ? null : Number(priceInput);
  const existing = list.find((p) => p[idField] === idValue && p.tier === tier);
  if (existing) {
    setList(list.map((p) => (p === existing ? { ...p, price } : p)));
  } else {
    setList([...list, { id: newId(), [idField]: idValue, tier, price }]);
  }
}

export default function BookingCalculator() {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [wholeHouseEnabled, setWholeHouseEnabled] = useState(true);
  const [discountCleaning, setDiscountCleaning] = useState(0);
  const [discountNoCleaning, setDiscountNoCleaning] = useState(0);
  const [consecutiveStayDefaultOption, setConsecutiveStayDefaultOption] = useState<'cleaning' | 'no_cleaning'>('no_cleaning');
  const [peakSeasonWeekdayTier, setPeakSeasonWeekdayTier] = useState<'peak' | 'weekday'>('peak');

  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [roomPricing, setRoomPricing] = useState<any[]>([]);
  const [roomExtraPersonPricing, setRoomExtraPersonPricing] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [packagePricing, setPackagePricing] = useState<any[]>([]);
  const [packageRooms, setPackageRooms] = useState<any[]>([]);
  const [extraRules, setExtraRules] = useState<any[]>([]);
  const [dateRanges, setDateRanges] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);

  const [newRange, setNewRange] = useState({ range_type: '旺季', start_date: '', end_date: '', label: '' });
  const [newPackage, setNewPackage] = useState<{ occupancy: number; roomIds: string[] }>({ occupancy: 10, roomIds: [] });

  const [quoteDate, setQuoteDate] = useState('');
  const [quoteHeadcount, setQuoteHeadcount] = useState(4);
  const [quoteNights, setQuoteNights] = useState(1);
  const [quotePromotionId, setQuotePromotionId] = useState<string>('');
  const [quoteCleaningOption, setQuoteCleaningOption] = useState<'cleaning' | 'noCleaning'>('noCleaning');
  const [quoteResult, setQuoteResult] = useState<MultiNightQuoteResult | null>(null);

  useEffect(() => {
    applyData(loadData());
  }, []);

  const applyData = (data: BookingData) => {
    setWholeHouseEnabled(data.settings.wholeHouseEnabled);
    setDiscountCleaning(data.settings.discountCleaning);
    setDiscountNoCleaning(data.settings.discountNoCleaning);
    setConsecutiveStayDefaultOption(data.settings.consecutiveStayDefaultOption);
    setPeakSeasonWeekdayTier(data.settings.peakSeasonWeekdayTier);
    setRoomTypes(data.roomTypes);
    setRoomPricing(data.roomPricing);
    setRoomExtraPersonPricing(data.roomExtraPersonPricing);
    setPackages(data.packages);
    setPackagePricing(data.packagePricing);
    setPackageRooms(data.packageRooms);
    setExtraRules(data.extraRules);
    setDateRanges(data.dateRanges);
    setPromotions(data.promotions);
    setNewPackage({ occupancy: 10, roomIds: [] });
  };

  const collectData = (): BookingData => ({
    settings: {
      wholeHouseEnabled,
      discountCleaning,
      discountNoCleaning,
      consecutiveStayDefaultOption,
      peakSeasonWeekdayTier,
    },
    roomTypes,
    roomPricing,
    roomExtraPersonPricing,
    packages,
    packagePricing,
    packageRooms,
    extraRules,
    dateRanges,
    promotions,
  });

  // ---------------- 儲存 / 匯出 / 匯入 ----------------
  const handleSaveAll = () => {
    setSaving(true);
    try {
      saveData(collectData());
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => exportDataAsFile(collectData());

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseImportedFile(String(reader.result));
        applyData(data);
        saveData(data);
        alert('匯入成功！');
      } catch {
        alert('匯入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
  };

  // ---------------- 房型 ----------------
  const addRoomType = () => {
    setRoomTypes([...roomTypes, { id: newId(), name: '新房型', floor: '', capacity: 2, max_extra_persons: 0, display_order: roomTypes.length, is_active: true }]);
  };

  const updateRoomType = (id: string, field: string, value: any) => {
    setRoomTypes(roomTypes.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteRoomType = (id: string) => {
    if (!confirm('確定要刪除這個房型嗎？相關定價與包棟房型組合也會一併刪除。')) return;
    setRoomTypes(roomTypes.filter((r) => r.id !== id));
    setRoomPricing(roomPricing.filter((p) => p.room_type_id !== id));
    setRoomExtraPersonPricing(roomExtraPersonPricing.filter((p) => p.room_type_id !== id));
    setPackageRooms(packageRooms.filter((pr) => pr.room_type_id !== id));
  };

  // ---------------- 包棟方案 ----------------
  const applySuggestedCombo = (occupancy: number) => {
    const suggested = suggestRoomCombo(occupancy, roomTypes);
    setNewPackage({ occupancy, roomIds: suggested.map((r) => r.id) });
  };

  const toggleNewPackageRoom = (roomId: string) => {
    setNewPackage((prev) => ({
      ...prev,
      roomIds: prev.roomIds.includes(roomId) ? prev.roomIds.filter((id) => id !== roomId) : [...prev.roomIds, roomId],
    }));
  };

  const newPackageCapacity = newPackage.roomIds.reduce((s, id) => s + (roomTypes.find((r) => r.id === id)?.capacity || 0), 0);

  const addPackage = () => {
    const pkgId = newId();
    setPackages([...packages, { id: pkgId, occupancy: newPackage.occupancy, display_order: packages.length }]);
    setPackageRooms([...packageRooms, ...newPackage.roomIds.map((roomId) => ({ id: newId(), package_id: pkgId, room_type_id: roomId }))]);
    setNewPackage({ occupancy: 10, roomIds: [] });
  };

  const deletePackage = (id: string) => {
    if (!confirm('確定要刪除這個包棟方案嗎？相關定價與房型組合也會一併刪除。')) return;
    setPackages(packages.filter((p) => p.id !== id));
    setPackagePricing(packagePricing.filter((p) => p.package_id !== id));
    setPackageRooms(packageRooms.filter((pr) => pr.package_id !== id));
  };

  const packageRoomNames = (packageId: string): string => {
    const roomIds = packageRooms.filter((pr) => pr.package_id === packageId).map((pr) => pr.room_type_id);
    return roomTypes.filter((r) => roomIds.includes(r.id)).map((r) => r.name).join('、') || '（未設定房型）';
  };

  // ---------------- 加人規則 ----------------
  const addExtraRule = () => {
    setExtraRules([...extraRules, { id: newId(), rule_type: 'no_extra_room', rule_label: '不開房', tier: '平日', price: null }]);
  };

  const updateExtraRule = (id: string, field: string, value: any) => {
    setExtraRules(extraRules.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const deleteExtraRule = (id: string) => {
    if (!confirm('確定要刪除這筆加人規則嗎？')) return;
    setExtraRules(extraRules.filter((r) => r.id !== id));
  };

  // ---------------- 日期區間 ----------------
  const addDateRange = () => {
    if (!newRange.start_date || !newRange.end_date) {
      alert('請填入起訖日期');
      return;
    }
    setDateRanges([...dateRanges, { id: newId(), ...newRange }].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setNewRange({ range_type: '旺季', start_date: '', end_date: '', label: '' });
  };

  const updateDateRange = (id: string, field: string, value: any) => {
    setDateRanges(dateRanges.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const deleteDateRange = (id: string) => {
    setDateRanges(dateRanges.filter((d) => d.id !== id));
  };

  // ---------------- 促銷方案 ----------------
  const addPromotion = () => {
    setPromotions([...promotions, { id: newId(), name: '新促銷方案', discount_percent: 0 }]);
  };

  const updatePromotion = (id: string, field: string, value: any) => {
    setPromotions(promotions.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const deletePromotion = (id: string) => {
    setPromotions(promotions.filter((p) => p.id !== id));
    if (quotePromotionId === id) setQuotePromotionId('');
  };

  // ---------------- 測試報價 ----------------
  const runTestQuote = () => {
    if (!quoteDate) {
      alert('請選擇入住日期');
      return;
    }
    const maxOccupancy = packages.length ? Math.max(...packages.map((p) => p.occupancy)) : 0;
    const selectedPromotion = promotions.find((p) => p.id === quotePromotionId) || null;
    const consecutiveStayDiscountPerNight = quoteCleaningOption === 'cleaning' ? discountCleaning : discountNoCleaning;
    const result = computeMultiNightQuote({
      checkInDate: new Date(`${quoteDate}T00:00:00`),
      nights: quoteNights,
      headcount: quoteHeadcount,
      dateRanges: dateRanges.map((d) => ({ range_type: d.range_type, start_date: d.start_date, end_date: d.end_date })),
      roomTypes,
      roomPricing,
      roomExtraPersonPricing,
      packages: wholeHouseEnabled ? packages : [],
      packagePricing: wholeHouseEnabled ? packagePricing : [],
      extraPersonRules: wholeHouseEnabled ? extraRules : [],
      maxOccupancy,
      promotion: selectedPromotion,
      consecutiveStayDiscountPerNight,
      peakSeasonWeekdayTier,
    });
    setQuoteResult(result);
  };

  // ---------------- 自動報價總表 ----------------
  const packageOccupancies = packages.map((p) => p.occupancy);
  const matrixMin = packageOccupancies.length ? Math.min(...packageOccupancies) : 0;
  const matrixMax = packageOccupancies.length ? Math.max(...packageOccupancies) : 0;
  const matrixRows: number[] = [];
  for (let h = matrixMin; h <= matrixMax; h++) matrixRows.push(h);

  const computeMatrixCell = (headcount: number, tier: string) => {
    const availableRooms = getAvailableIndividualRooms(tier, roomTypes, roomPricing, roomExtraPersonPricing);
    const individualOption = availableRooms.length ? computeIndividualOptions(headcount, availableRooms) : null;
    const wholeHouseOption = selectWholeHousePackage(headcount, packages, packagePricing, extraRules, tier, matrixMax);
    const upgradeOption = selectWholeHouseUpgradeOption(headcount, packages, packagePricing, tier);
    const recommendation = compareOptions(individualOption, wholeHouseOption);
    const baseTotal = wholeHouseOption
      ? wholeHouseOption.extraPersonOptions.length
        ? Math.min(...wholeHouseOption.extraPersonOptions.map((o) => o.grandTotal))
        : wholeHouseOption.basePrice
      : null;
    // 只有升等後套用的級距跟「不開房」的基礎級距不同（代表人數卡在兩個級距中間），才視為獨立的第二個價格顯示
    const showUpgrade = upgradeOption && wholeHouseOption && upgradeOption.package.id !== wholeHouseOption.package.id;
    return { baseTotal, upgradePrice: showUpgrade ? (upgradeOption as NonNullable<typeof upgradeOption>).price : null, recommendation };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">房型／定價設定</h2>
          <p className="text-gray-500 mt-1">
            所有變更會先暫存在畫面上，按「儲存變更」才會真正寫入瀏覽器儲存空間（不用登入、不會上傳到任何伺服器）。
            {savedAt ? <span className="text-green-600"> 已於 {savedAt.toLocaleTimeString('zh-TW')} 儲存。</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4" />
            匯入設定
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            匯出備份
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            {saving ? '儲存中...' : '儲存變更'}
          </button>
        </div>
      </div>

      {/* 房型與定價 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-600" />
            房型與定價
          </h3>
          <button onClick={addRoomType} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> 新增房型
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-gray-600">
                <th className="py-3 px-4">房型名稱</th>
                <th className="py-3 px-4">樓層</th>
                <th className="py-3 px-4">容納人數</th>
                <th className="py-3 px-4">最多加人</th>
                <th className="py-3 px-4">排序</th>
                <th className="py-3 px-4">啟用</th>
                {PRICING_TIERS.map((t) => (
                  <th key={t} className="py-3 px-4">{t}</th>
                ))}
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roomTypes.map((r) => (
                <tr key={r.id}>
                  <td className="p-2">
                    <input value={r.name} onChange={(e) => updateRoomType(r.id, 'name', e.target.value)} className="w-28 px-2 py-1 border rounded" />
                  </td>
                  <td className="p-2">
                    <input value={r.floor} onChange={(e) => updateRoomType(r.id, 'floor', e.target.value)} className="w-16 px-2 py-1 border rounded" placeholder="2F" />
                  </td>
                  <td className="p-2">
                    <input type="number" value={r.capacity} onChange={(e) => updateRoomType(r.id, 'capacity', Number(e.target.value))} className="w-16 px-2 py-1 border rounded" />
                  </td>
                  <td className="p-2">
                    <input type="number" min={0} value={r.max_extra_persons ?? 0} onChange={(e) => updateRoomType(r.id, 'max_extra_persons', Number(e.target.value))} className="w-16 px-2 py-1 border rounded" title="0＝不支援加人" />
                  </td>
                  <td className="p-2">
                    <input type="number" value={r.display_order} onChange={(e) => updateRoomType(r.id, 'display_order', Number(e.target.value))} className="w-14 px-2 py-1 border rounded" />
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={r.is_active} onChange={(e) => updateRoomType(r.id, 'is_active', e.target.checked)} />
                  </td>
                  {PRICING_TIERS.map((tier) => (
                    <td key={tier} className="p-2">
                      <input
                        type="number"
                        value={getTierPrice(roomPricing, 'room_type_id', r.id, tier)}
                        onChange={(e) => setTierPrice(roomPricing, setRoomPricing, 'room_type_id', r.id, tier, e.target.value)}
                        className="w-20 px-2 py-1 border rounded"
                        placeholder="留空=不開放"
                      />
                    </td>
                  ))}
                  <td className="p-2">
                    <button onClick={() => deleteRoomType(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {roomTypes.length === 0 && (
                <tr>
                  <td colSpan={7 + PRICING_TIERS.length} className="py-10 text-center text-gray-400">
                    尚未設定房型，點右上角「新增房型」開始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 px-6 py-3 border-t">
          某個 tier 留空＝該 tier 不開放個別租房（顧客只能選包棟）。之後要開放，把價格填上即可，不用額外設定日期區間。「最多加人」設 0 代表該房型不支援加人不加房，人數超過容納人數時只能開另一間房。
        </p>

        <div className="p-6 border-t">
          <p className="text-sm font-medium text-gray-700 mb-1">加人不加房：每人加價</p>
          <p className="text-xs text-gray-400 mb-3">只有「最多加人」大於 0 的房型才會出現在這裡。例如某人數剛好多 1、2 位時，系統會優先試算「塞進已選房間加價」跟「多開一間房」兩種選項，讓顧客選。</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-gray-600">
                  <th className="py-2 px-3">房型</th>
                  {MATRIX_TIERS.map((t) => (
                    <th key={t} className="py-2 px-3">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roomTypes.filter((r) => (r.max_extra_persons ?? 0) > 0).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-medium">{r.name}（最多加 {r.max_extra_persons} 人）</td>
                    {MATRIX_TIERS.map((tier) => (
                      <td key={tier} className="p-2">
                        <input
                          type="number"
                          value={getTierPrice(roomExtraPersonPricing, 'room_type_id', r.id, tier)}
                          onChange={(e) => setTierPrice(roomExtraPersonPricing, setRoomExtraPersonPricing, 'room_type_id', r.id, tier, e.target.value)}
                          className="w-20 px-2 py-1 border rounded"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {roomTypes.filter((r) => (r.max_extra_persons ?? 0) > 0).length === 0 && (
                  <tr>
                    <td colSpan={1 + MATRIX_TIERS.length} className="py-6 text-center text-gray-400">
                      目前沒有房型設定「最多加人」大於 0
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 包棟方案與定價 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            包棟方案與定價
          </h3>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            啟用包棟方案
            <input type="checkbox" checked={wholeHouseEnabled} onChange={(e) => setWholeHouseEnabled(e.target.checked)} className="w-4 h-4" />
          </label>
        </div>

        {!wholeHouseEnabled ? (
          <p className="p-6 text-sm text-gray-400">已關閉包棟方案，只會看到個別房型租房選項。開啟後可設定包棟人數級距與定價。</p>
        ) : (
          <>
            <div className="p-6 border-b bg-gray-50 space-y-3">
              <p className="text-sm font-medium text-gray-700">新增方案</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-500">動人數</span>
                <input
                  type="number"
                  value={newPackage.occupancy}
                  onChange={(e) => applySuggestedCombo(Number(e.target.value))}
                  className="w-20 px-2 py-1 border rounded"
                />
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Wand2 className="w-3.5 h-3.5" />
                  已自動建議下方房型組合，可手動調整（已勾選容納：{newPackageCapacity} 人）
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {roomTypes.filter((r) => r.is_active).map((r) => {
                  const checked = newPackage.roomIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer ${checked ? 'bg-purple-50 border-purple-300' : 'border-gray-200'}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleNewPackageRoom(r.id)} />
                      {r.name}（{r.capacity}人）
                    </label>
                  );
                })}
              </div>
              <button onClick={addPackage} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-purple-700">
                <Plus className="w-4 h-4" /> 新增這個方案
              </button>
            </div>

            <div className="overflow-x-auto border-b">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-gray-600">
                    <th className="py-3 px-4">動人數</th>
                    <th className="py-3 px-4">房型組合</th>
                    {PRICING_TIERS.map((t) => (
                      <th key={t} className="py-3 px-4">{t}</th>
                    ))}
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {packages.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2">
                        <input type="number" value={p.occupancy} onChange={(e) => setPackages(packages.map((x) => (x.id === p.id ? { ...x, occupancy: Number(e.target.value) } : x)))} className="w-16 px-2 py-1 border rounded" />
                      </td>
                      <td className="p-2 text-gray-600">{packageRoomNames(p.id)}</td>
                      {PRICING_TIERS.map((tier) => (
                        <td key={tier} className="p-2">
                          <input
                            type="number"
                            value={getTierPrice(packagePricing, 'package_id', p.id, tier)}
                            onChange={(e) => setTierPrice(packagePricing, setPackagePricing, 'package_id', p.id, tier, e.target.value)}
                            className="w-20 px-2 py-1 border rounded"
                          />
                        </td>
                      ))}
                      <td className="p-2">
                        <button onClick={() => deletePackage(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {packages.length === 0 && (
                    <tr>
                      <td colSpan={3 + PRICING_TIERS.length} className="py-10 text-center text-gray-400">
                        尚未設定包棟方案
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-b">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-medium text-gray-700">超額加人規則</p>
                <button onClick={addExtraRule} className="flex items-center gap-1 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800">
                  <Plus className="w-4 h-4" /> 新增規則
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-gray-600">
                      <th className="py-2 px-3">類型</th>
                      <th className="py-2 px-3">顯示名稱</th>
                      <th className="py-2 px-3">tier</th>
                      <th className="py-2 px-3">每人加價</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {extraRules.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2">
                          <select value={r.rule_type} onChange={(e) => updateExtraRule(r.id, 'rule_type', e.target.value)} className="px-2 py-1 border rounded bg-white">
                            {RULE_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input value={r.rule_label} onChange={(e) => updateExtraRule(r.id, 'rule_label', e.target.value)} className="w-32 px-2 py-1 border rounded" placeholder="不加床、不開房" />
                        </td>
                        <td className="p-2">
                          <select value={r.tier} onChange={(e) => updateExtraRule(r.id, 'tier', e.target.value)} className="px-2 py-1 border rounded bg-white">
                            {MATRIX_TIERS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={r.price ?? ''}
                            onChange={(e) => updateExtraRule(r.id, 'price', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-24 px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="p-2">
                          <button onClick={() => deleteExtraRule(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {extraRules.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400">
                          尚未設定加人規則
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {matrixRows.length > 0 && (
              <div className="p-6">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-orange-600" />
                  自動報價總表（唯讀，即時算好）
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  資料改了會自動重算，不用理解演算法，直接看數字對不對；「與個別租房比較」是自動算出來的省多少錢。
                  人數卡在兩個級距中間時（例如 11、13、15 人）會多顯示「開房」（直接跳去用更大級距的整組價格）跟「不開房」（維持較小級距、超額用加人規則計算）兩種價格。
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr className="text-gray-600">
                        <th className="py-2 px-3">人數</th>
                        {MATRIX_TIERS.map((t) => (
                          <th key={t} className="py-2 px-3">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {matrixRows.map((h) => (
                        <tr key={h}>
                          <td className="py-2 px-3 font-semibold">{h} 人</td>
                          {MATRIX_TIERS.map((tier) => {
                            const { baseTotal, upgradePrice, recommendation } = computeMatrixCell(h, tier);
                            return (
                              <td key={tier} className="py-2 px-3">
                                {baseTotal == null && upgradePrice == null ? (
                                  <span className="text-gray-300">—</span>
                                ) : (
                                  <div className="space-y-1">
                                    {baseTotal != null && (
                                      <div>
                                        <span className="text-xs text-gray-400">不開房 </span>
                                        NT$ {baseTotal.toLocaleString()}
                                        {recommendation.recommended === 'wholeHouse' && recommendation.savings ? (
                                          <span className="inline-block ml-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                            省 NT$ {recommendation.savings.toLocaleString()}
                                          </span>
                                        ) : null}
                                      </div>
                                    )}
                                    {upgradePrice != null && (
                                      <div className="text-gray-600">
                                        <span className="text-xs text-gray-400">開房 </span>
                                        NT$ {upgradePrice.toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 日期區間 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800">旺季／連假日期區間</h3>
          <p className="text-sm text-gray-500 mt-1">
            完全由這裡新增/編輯/刪除（優先順序：旺季 &gt; 連假 &gt; 一般日期依星期幾判斷）。
          </p>
        </div>

        <div className="p-6 border-b">
          <label className="block text-xs text-gray-500 mb-1">旺季期間的平日（日~四）要套用哪種價格</label>
          <select value={peakSeasonWeekdayTier} onChange={(e) => setPeakSeasonWeekdayTier(e.target.value as 'peak' | 'weekday')} className="px-3 py-2 border rounded-lg bg-white">
            <option value="peak">旺季價（預設，不分平假日一律旺季價）</option>
            <option value="weekday">平日價（旺季期間的平日改用平日價，小假日仍是旺季價）</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">同時套用在個別租房與包棟的定價判斷。</p>
        </div>

        <div className="p-6 border-b flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">類型</label>
            <select value={newRange.range_type} onChange={(e) => setNewRange({ ...newRange, range_type: e.target.value })} className="px-3 py-2 border rounded-lg bg-white">
              <option value="旺季">旺季</option>
              <option value="連假">連假</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">起始日期</label>
            <input type="date" value={newRange.start_date} onChange={(e) => setNewRange({ ...newRange, start_date: e.target.value })} className="px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">結束日期</label>
            <input type="date" value={newRange.end_date} onChange={(e) => setNewRange({ ...newRange, end_date: e.target.value })} className="px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-500 mb-1">備註</label>
            <input value={newRange.label} onChange={(e) => setNewRange({ ...newRange, label: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="例如：端午連假" />
          </div>
          <button onClick={addDateRange} className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            <Plus className="w-4 h-4" /> 新增區間
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-gray-600">
                <th className="py-3 px-4">類型</th>
                <th className="py-3 px-4">起始日期</th>
                <th className="py-3 px-4">結束日期</th>
                <th className="py-3 px-4">備註</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dateRanges.map((d) => (
                <tr key={d.id}>
                  <td className="p-2">
                    <select value={d.range_type} onChange={(e) => updateDateRange(d.id, 'range_type', e.target.value)} className="px-2 py-1 border rounded bg-white">
                      <option value="旺季">旺季</option>
                      <option value="連假">連假</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="date" value={d.start_date} onChange={(e) => updateDateRange(d.id, 'start_date', e.target.value)} className="px-2 py-1 border rounded" />
                  </td>
                  <td className="p-2">
                    <input type="date" value={d.end_date} onChange={(e) => updateDateRange(d.id, 'end_date', e.target.value)} className="px-2 py-1 border rounded" />
                  </td>
                  <td className="p-2">
                    <input value={d.label} onChange={(e) => updateDateRange(d.id, 'label', e.target.value)} className="w-40 px-2 py-1 border rounded" placeholder="例如：端午連假" />
                  </td>
                  <td className="p-2">
                    <button onClick={() => deleteDateRange(d.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {dateRanges.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    尚未設定任何日期區間
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 試算報價 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            試算報價
          </h3>
          <p className="text-sm text-gray-500 mt-1">用畫面上目前（含未儲存）的資料試算，方便調整完馬上驗證，不用先儲存。</p>
        </div>

        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-gray-700">促銷方案（名稱 + 折扣%，只套用在第一晚）</p>
            <button onClick={addPromotion} className="flex items-center gap-1 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800">
              <Plus className="w-4 h-4" /> 新增方案
            </button>
          </div>
          <div className="space-y-2">
            {promotions.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <input value={p.name} onChange={(e) => updatePromotion(p.id, 'name', e.target.value)} className="flex-1 px-2 py-1 border rounded" placeholder="促銷方案名稱" />
                <input type="number" value={p.discount_percent} onChange={(e) => updatePromotion(p.id, 'discount_percent', Number(e.target.value))} className="w-20 px-2 py-1 border rounded" />
                <span className="text-xs text-gray-400">% 折扣</span>
                <button onClick={() => deletePromotion(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {promotions.length === 0 && <p className="text-sm text-gray-400">尚未設定促銷方案</p>}
          </div>
        </div>

        <div className="p-6 border-b">
          <p className="text-sm font-medium text-gray-700 mb-3">連住折扣（固定金額，第二晚（含）以後每晚折抵）</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">需打掃，每晚折抵</label>
              <input type="number" value={discountCleaning} onChange={(e) => setDiscountCleaning(Number(e.target.value))} className="w-32 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">無需打掃，每晚折抵</label>
              <input type="number" value={discountNoCleaning} onChange={(e) => setDiscountNoCleaning(Number(e.target.value))} className="w-32 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">預設套用哪一種</label>
              <select value={consecutiveStayDefaultOption} onChange={(e) => setConsecutiveStayDefaultOption(e.target.value as 'cleaning' | 'no_cleaning')} className="px-3 py-2 border rounded-lg bg-white">
                <option value="no_cleaning">無需打掃</option>
                <option value="cleaning">需打掃</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-wrap gap-3 items-end border-b">
          <div>
            <label className="block text-xs text-gray-500 mb-1">入住日期</label>
            <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">人數</label>
            <input type="number" min={1} value={quoteHeadcount} onChange={(e) => setQuoteHeadcount(Number(e.target.value))} className="w-20 px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">晚數</label>
            <input type="number" min={1} value={quoteNights} onChange={(e) => setQuoteNights(Math.max(1, Number(e.target.value)))} className="w-20 px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">促銷方案</label>
            <select value={quotePromotionId} onChange={(e) => setQuotePromotionId(e.target.value)} className="px-3 py-2 border rounded-lg bg-white">
              <option value="">無</option>
              {promotions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}（{p.discount_percent}%）</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">第二晚起（連住折扣）</label>
            <select value={quoteCleaningOption} onChange={(e) => setQuoteCleaningOption(e.target.value as 'cleaning' | 'noCleaning')} className="px-3 py-2 border rounded-lg bg-white">
              <option value="noCleaning">無需打掃</option>
              <option value="cleaning">需打掃</option>
            </select>
          </div>
          <button onClick={runTestQuote} className="flex items-center gap-1 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700">
            <Calculator className="w-4 h-4" /> 試算
          </button>
        </div>

        {quoteResult && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">個別租房</h4>
                <div className="text-sm space-y-1">
                  {quoteResult.individual.nights.map((n, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        {n.date.toLocaleDateString('zh-TW')}（{n.tier}）{i === 0 ? '　第一晚' : `　第${i + 1}晚`}
                      </span>
                      <span>{n.discountedPrice == null ? '不可用' : `NT$ ${n.discountedPrice.toLocaleString()}`}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span>總計</span>
                    <span>{quoteResult.individual.total == null ? '無法報價' : `NT$ ${quoteResult.individual.total.toLocaleString()}`}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-gray-700 mb-2">包棟</h4>
                {!wholeHouseEnabled ? (
                  <p className="text-sm text-gray-400">目前已關閉包棟方案</p>
                ) : (
                  <div className="text-sm space-y-1">
                    {quoteResult.wholeHouse.nights.map((n, i) => (
                      <div key={i} className="flex justify-between">
                        <span>
                          {n.date.toLocaleDateString('zh-TW')}（{n.tier}）{i === 0 ? '　第一晚' : `　第${i + 1}晚`}
                        </span>
                        <span>{n.discountedPrice == null ? '不可用' : `NT$ ${n.discountedPrice.toLocaleString()}`}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t pt-1 mt-1">
                      <span>總計</span>
                      <span>{quoteResult.wholeHouse.total == null ? '無法報價' : `NT$ ${quoteResult.wholeHouse.total.toLocaleString()}`}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {quoteResult.individual.total != null && quoteResult.wholeHouse.total != null && (
              <p className="text-sm">
                {quoteResult.individual.total < quoteResult.wholeHouse.total ? (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                    個別租房較划算，省 NT$ {(quoteResult.wholeHouse.total - quoteResult.individual.total).toLocaleString()}
                  </span>
                ) : quoteResult.wholeHouse.total < quoteResult.individual.total ? (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                    包棟較划算，省 NT$ {(quoteResult.individual.total - quoteResult.wholeHouse.total).toLocaleString()}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
