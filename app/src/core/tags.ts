import { z } from 'zod';

/** Where an item sits in an outfit. The first six are the recommender's slots; accessory and headwear are kept but not suggested (spec §8, §14). */
export const SLOTS = ['top', 'mid', 'bottom', 'onepiece', 'shoes', 'outer', 'accessory', 'headwear'] as const;
export type Slot = (typeof SLOTS)[number];

/** An item's life: drafts wait for review (M2), laundry and archived stay out of suggestions, wishlist is not owned yet. */
export const STATUSES = ['draft', 'active', 'laundry', 'archived', 'wishlist'] as const;
export type Status = (typeof STATUSES)[number];

/** The statuses a person sets by hand; `draft` belongs to the tagging queue (M2). */
export const CHOSEN_STATUSES = ['active', 'laundry', 'archived', 'wishlist'] as const satisfies readonly Status[];
export type ChosenStatus = (typeof CHOSEN_STATUSES)[number];

/** Subcategories per slot. Short on purpose: the tagging prompt (M2) offers exactly these. */
export const SUBCATEGORIES = {
  top: ['tshirt', 'tank', 'longsleeve', 'shirt', 'polo', 'blouse', 'sweatshirt', 'hoodie', 'sweater', 'turtleneck'],
  mid: ['cardigan', 'zip_hoodie', 'overshirt', 'vest', 'blazer'],
  bottom: ['jeans', 'trousers', 'chinos', 'cargo', 'joggers', 'shorts', 'skirt', 'leggings'],
  onepiece: ['dress', 'jumpsuit', 'overalls'],
  shoes: ['boots', 'chelsea_boots', 'combat_boots', 'sneakers', 'loafers', 'derby', 'sandals', 'heels'],
  outer: ['leather_jacket', 'denim_jacket', 'bomber', 'trench', 'coat', 'parka', 'puffer', 'raincoat'],
  accessory: ['belt', 'bag', 'scarf', 'gloves', 'jewelry', 'watch', 'sunglasses', 'tie'],
  headwear: ['cap', 'beanie', 'hat', 'bandana'],
} as const satisfies Record<Slot, readonly string[]>;
export type Subcategory = (typeof SUBCATEGORIES)[Slot][number];

/** Every subcategory of every slot, for the schema. */
const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES).flat() as readonly Subcategory[];

/** Named colours. Dark shades are split finely because the wardrobe is mostly dark (spec §1). */
export const COLORS = [
  'black', 'charcoal', 'grey', 'white', 'cream', 'beige', 'brown', 'navy', 'blue', 'green',
  'olive', 'burgundy', 'red', 'pink', 'purple', 'yellow', 'orange', 'silver', 'gold',
] as const;
export type Color = (typeof COLORS)[number];

/** Fibres and hides. Suede, nubuck, canvas and mesh matter for the rain rule (spec §8). */
export const MATERIALS = [
  'cotton', 'denim', 'leather', 'faux_leather', 'suede', 'nubuck', 'wool', 'cashmere', 'linen', 'silk',
  'polyester', 'nylon', 'viscose', 'canvas', 'mesh', 'fleece', 'corduroy', 'velvet', 'rubber',
] as const;
export type Material = (typeof MATERIALS)[number];

/** Texture families: the recommender counts the distinct families in an outfit (spec §8, `texture`). */
export const TEXTURES = ['smooth', 'knit', 'ribbed', 'denim', 'leather', 'suede', 'corduroy', 'fleece', 'quilted', 'satin', 'mesh', 'velvet'] as const;
export type Texture = (typeof TEXTURES)[number];

/** Surface patterns; `graphic` is forbidden at work (spec §8). */
export const PATTERNS = ['solid', 'graphic', 'logo', 'striped', 'checked', 'floral', 'animal', 'camo'] as const;
export type Pattern = (typeof PATTERNS)[number];

/** Fit, tightest first; the recommender pairs fitted with loose (spec §8, `silhouette`). */
export const SILHOUETTES = ['fitted', 'regular', 'relaxed', 'oversized'] as const;
export type Silhouette = (typeof SILHOUETTES)[number];

/** Seasons an item is worn in; none means all of them (spec §8 season filter). */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Details the rules read: hardware (weights in spec §8), damage (forbidden at work), open toes (rain), hoods. */
export const DETAILS = ['exposed_zip', 'd_ring', 'eyelet', 'buckle', 'grommets', 'chain', 'studs', 'spikes', 'ripped', 'distressed', 'open_toe', 'hood'] as const;
export type Detail = (typeof DETAILS)[number];

/** Visible wear, best first (spec §5). */
export const CONDITIONS = ['new_with_tags', 'like_new', 'good', 'worn', 'poor'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** How a photo was taken: laid flat, on a hanger, worn (a fit photo), or a whole outfit (M3). */
export const PHOTO_KINDS = ['flat', 'hanger', 'worn', 'outfit'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
/** The kinds a new item's photo can be; outfit photos belong to outfits. */
export type ItemPhotoKind = Exclude<PhotoKind, 'outfit'>;

/** The 1-to-5 scale of formality (beachwear to a suit) and warmth (a tank top to a down coat). */
export const SCALE = [1, 2, 3, 4, 5] as const;
export type Scale = (typeof SCALE)[number];

/** The tags a person (M1) or the tagging call (M2) fills. Only `slot` is required; lists may be empty. */
export const ItemTagsSchema = z
  .object({
    slot: z.enum(SLOTS),
    subcategory: z.enum(ALL_SUBCATEGORIES as readonly [Subcategory, ...Subcategory[]]).nullable(),
    // Four colours describe any garment; more is a pattern.
    colors: z.array(z.enum(COLORS)).max(4),
    material: z.enum(MATERIALS).nullable(),
    texture: z.enum(TEXTURES).nullable(),
    pattern: z.enum(PATTERNS).nullable(),
    silhouette: z.enum(SILHOUETTES).nullable(),
    formality: z.number().int().min(1).max(5).nullable(),
    warmth: z.number().int().min(1).max(5).nullable(),
    seasons: z.array(z.enum(SEASONS)),
    details: z.array(z.enum(DETAILS)),
    // Brand names are short; 60 characters stops a pasted paragraph.
    brand: z.string().trim().min(1).max(60).nullable(),
    condition: z.enum(CONDITIONS).nullable(),
    // TRY; a million is far above any garment and catches a typo with extra zeros.
    price: z.number().nonnegative().max(1_000_000).nullable(),
    // A few sentences at most.
    notes: z.string().max(500).nullable(),
  })
  .refine((t) => t.subcategory === null || (SUBCATEGORIES[t.slot] as readonly string[]).includes(t.subcategory), {
    message: 'subcategory does not belong to slot',
    path: ['subcategory'],
  });
export type ItemTags = z.infer<typeof ItemTagsSchema>;
