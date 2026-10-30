import type { ThemeMode } from '../data/settings';
import type { CutoutState } from '../core/photo';
import { CHOSEN_STATUSES } from '../core/tags';
import type {
  ChosenStatus, Color, Condition, Detail, ItemPhotoKind, Material, Pattern, PhotoKind, Scale, Season,
  Silhouette, Slot, Status, Subcategory, Texture,
} from '../core/tags';

/** Tab titles, by route name. */
export const TAB_TR = {
  index: 'Gardırop',
  outfits: 'Kombinler',
  today: 'Bugün',
  settings: 'Ayarlar',
} as const;

/** The theme modes in the order the Ayarlar picker shows them. */
export const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];

/** The name of each theme mode in the Ayarlar picker. */
export const THEME_MODE_TR: Record<ThemeMode, string> = {
  dark: 'Koyu',
  light: 'Açık',
  system: 'Sistem',
};

/** The name of each slot. */
export const SLOT_TR: Record<Slot, string> = {
  top: 'Üst',
  mid: 'Ara katman',
  bottom: 'Alt',
  onepiece: 'Tek parça',
  shoes: 'Ayakkabı',
  outer: 'Dış giyim',
  accessory: 'Aksesuar',
  headwear: 'Başlık',
};

/** The name of each status. */
export const STATUS_TR: Record<Status, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  laundry: 'Çamaşırda',
  archived: 'Arşivde',
  wishlist: 'İstek listesi',
};

/** The name of each subcategory. */
export const SUBCATEGORY_TR: Record<Subcategory, string> = {
  tshirt: 'Tişört',
  tank: 'Atlet',
  longsleeve: 'Uzun kollu',
  shirt: 'Gömlek',
  polo: 'Polo',
  blouse: 'Bluz',
  sweatshirt: 'Sweatshirt',
  hoodie: 'Kapüşonlu',
  sweater: 'Kazak',
  turtleneck: 'Balıkçı yaka',
  cardigan: 'Hırka',
  zip_hoodie: 'Fermuarlı kapüşonlu',
  overshirt: 'Gömlek ceket',
  vest: 'Yelek',
  blazer: 'Blazer',
  jeans: 'Kot pantolon',
  trousers: 'Kumaş pantolon',
  chinos: 'Chino',
  cargo: 'Kargo',
  joggers: 'Eşofman altı',
  shorts: 'Şort',
  skirt: 'Etek',
  leggings: 'Tayt',
  dress: 'Elbise',
  jumpsuit: 'Tulum',
  overalls: 'Salopet',
  boots: 'Bot',
  chelsea_boots: 'Chelsea bot',
  combat_boots: 'Postal',
  sneakers: 'Spor ayakkabı',
  loafers: 'Loafer',
  derby: 'Derby',
  sandals: 'Sandalet',
  heels: 'Topuklu',
  leather_jacket: 'Deri ceket',
  denim_jacket: 'Kot ceket',
  bomber: 'Bomber',
  trench: 'Trençkot',
  coat: 'Kaban',
  parka: 'Parka',
  puffer: 'Şişme mont',
  raincoat: 'Yağmurluk',
  belt: 'Kemer',
  bag: 'Çanta',
  scarf: 'Atkı',
  gloves: 'Eldiven',
  jewelry: 'Takı',
  watch: 'Saat',
  sunglasses: 'Güneş gözlüğü',
  tie: 'Kravat',
  cap: 'Kep',
  beanie: 'Bere',
  hat: 'Şapka',
  bandana: 'Bandana',
};

/** The name of each colour. */
export const COLOR_TR: Record<Color, string> = {
  black: 'Siyah',
  charcoal: 'Antrasit',
  grey: 'Gri',
  white: 'Beyaz',
  cream: 'Krem',
  beige: 'Bej',
  brown: 'Kahverengi',
  navy: 'Lacivert',
  blue: 'Mavi',
  green: 'Yeşil',
  olive: 'Haki',
  burgundy: 'Bordo',
  red: 'Kırmızı',
  pink: 'Pembe',
  purple: 'Mor',
  yellow: 'Sarı',
  orange: 'Turuncu',
  silver: 'Gümüş',
  gold: 'Altın',
};

/** The name of each material. */
export const MATERIAL_TR: Record<Material, string> = {
  cotton: 'Pamuk',
  denim: 'Denim',
  leather: 'Deri',
  faux_leather: 'Suni deri',
  suede: 'Süet',
  nubuck: 'Nubuk',
  wool: 'Yün',
  cashmere: 'Kaşmir',
  linen: 'Keten',
  silk: 'İpek',
  polyester: 'Polyester',
  nylon: 'Naylon',
  viscose: 'Viskon',
  canvas: 'Kanvas',
  mesh: 'File',
  fleece: 'Polar',
  corduroy: 'Fitilli kadife',
  velvet: 'Kadife',
  rubber: 'Kauçuk',
};

/** The name of each texture family. */
export const TEXTURE_TR: Record<Texture, string> = {
  smooth: 'Pürüzsüz',
  knit: 'Örgü',
  ribbed: 'Ribana',
  denim: 'Denim',
  leather: 'Deri',
  suede: 'Süet',
  corduroy: 'Fitilli kadife',
  fleece: 'Polar',
  quilted: 'Kapitone',
  satin: 'Saten',
  mesh: 'File',
  velvet: 'Kadife',
};

/** The name of each pattern. */
export const PATTERN_TR: Record<Pattern, string> = {
  solid: 'Düz',
  graphic: 'Baskılı',
  logo: 'Logolu',
  striped: 'Çizgili',
  checked: 'Kareli',
  floral: 'Çiçekli',
  animal: 'Hayvan deseni',
  camo: 'Kamuflaj',
};

/** The name of each fit. */
export const SILHOUETTE_TR: Record<Silhouette, string> = {
  fitted: 'Dar',
  regular: 'Normal',
  relaxed: 'Rahat',
  oversized: 'Oversize',
};

/** The name of each season. */
export const SEASON_TR: Record<Season, string> = {
  spring: 'İlkbahar',
  summer: 'Yaz',
  autumn: 'Sonbahar',
  winter: 'Kış',
};

/** The name of each detail. */
export const DETAIL_TR: Record<Detail, string> = {
  exposed_zip: 'Açık fermuar',
  d_ring: 'D halka',
  eyelet: 'Kuşgözü',
  buckle: 'Toka',
  grommets: 'Büyük kuşgözü',
  chain: 'Zincir',
  studs: 'Zımba',
  spikes: 'Sivri zımba',
  ripped: 'Yırtık',
  distressed: 'Eskitme',
  open_toe: 'Açık burun',
  hood: 'Kapüşon',
};

/** The name of each condition. */
export const CONDITION_TR: Record<Condition, string> = {
  new_with_tags: 'Etiketli yeni',
  like_new: 'Yeni gibi',
  good: 'İyi',
  worn: 'Yıpranmış',
  poor: 'Kötü',
};

/** The name of each photo kind. */
export const PHOTO_KIND_TR: Record<PhotoKind, string> = {
  flat: 'Zeminde',
  hanger: 'Askıda',
  worn: 'Üstümde',
  outfit: 'Kombin',
};

/** One line under each kind on the add screen. */
export const PHOTO_KIND_HINT_TR: Record<ItemPhotoKind, string> = {
  flat: 'düz bir zemine serili',
  hanger: 'askıda asılı',
  worn: 'üstümde, aynada',
};

/** The kinds the add screen offers, in its order. */
export const ITEM_PHOTO_KINDS: readonly ItemPhotoKind[] = ['flat', 'hanger', 'worn'];

/** Formality, 1 to 5. */
export const FORMALITY_TR: Record<Scale, string> = {
  1: 'Çok rahat',
  2: 'Rahat',
  3: 'Smart casual',
  4: 'Şık',
  5: 'Resmî',
};

/** Warmth, 1 to 5. */
export const WARMTH_TR: Record<Scale, string> = {
  1: 'Çok ince',
  2: 'İnce',
  3: 'Orta',
  4: 'Sıcak',
  5: 'Çok sıcak',
};

/** What happened to a photo's background, for the item screen. */
export const CUTOUT_TR: Record<CutoutState, string> = {
  none: 'Arka plan temizlenmeyecek',
  pending: 'Arka plan sonra temizlenecek',
  done: 'Arka plan şeffaf',
  failed: 'Arka plan temizlenemedi',
};

/** Statuses as the item screen and the filter list them. */
export const CHOSEN_STATUS_TR = Object.fromEntries(CHOSEN_STATUSES.map((status) => [status, STATUS_TR[status]])) as Record<ChosenStatus, string>;
