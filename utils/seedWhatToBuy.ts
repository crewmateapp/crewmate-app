// utils/seedWhatToBuy.ts
// Seeds realistic crew recommendations for What to Buy.
// Run from admin panel — credits items to the specified user.

import { db } from '@/config/firebase';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';

type SeedItem = {
  city: string;
  itemName: string;
  category: string;
  storeName?: string;
  tip: string;
};

// ─── San Francisco ──────────────────────────────────────────────────────────

const SFO_ITEMS: SeedItem[] = [
  // Wine & Spirits
  {
    city: 'San Francisco',
    itemName: 'Sonoma County Pinot Noir',
    category: 'wine',
    storeName: "Trader Joe's (Masonic Ave)",
    tip: 'Under $12 and rivals bottles twice the price. Grab a couple for the hotel or to bring home.',
  },
  {
    city: 'San Francisco',
    itemName: 'Anchor Steam 6-pack',
    category: 'wine',
    storeName: 'Whole Foods (Market St)',
    tip: 'The original SF craft beer. Grab the variety pack — every one is solid.',
  },
  // Skincare
  {
    city: 'San Francisco',
    itemName: "Dr. Bronner's Gift Set",
    category: 'skincare',
    storeName: 'Rainbow Grocery',
    tip: 'Way cheaper here than airports or Amazon. The lavender is perfect for post-flight recovery.',
  },
  {
    city: 'San Francisco',
    itemName: 'Tatcha Dewy Skin Cream',
    category: 'skincare',
    storeName: 'Sephora (Powell St)',
    tip: "The flagship store usually has samples and sets you can't find online. Great for dry airplane skin.",
  },
  // Groceries
  {
    city: 'San Francisco',
    itemName: 'Sourdough bread loaf',
    category: 'groceries',
    storeName: "Boudin Bakery (Fisherman's Wharf)",
    tip: 'THE SF souvenir. They sell it packaged for travel. Grab a round loaf — it lasts 3-4 days.',
  },
  {
    city: 'San Francisco',
    itemName: 'Ghirardelli chocolate squares bag',
    category: 'groceries',
    storeName: 'Ghirardelli Square',
    tip: "The bags at the actual Ghirardelli store are bigger and fresher than CVS. Stock up for the crew lounge.",
  },
  // Snacks
  {
    city: 'San Francisco',
    itemName: 'Bi-Rite Creamery ice cream pint',
    category: 'snacks',
    storeName: 'Bi-Rite Creamery (18th St)',
    tip: 'Salted caramel is legendary. Worth the line. Bring a cooler bag if you want to bring pints home.',
  },
  {
    city: 'San Francisco',
    itemName: 'Everything But the Bagel seasoning',
    category: 'snacks',
    storeName: "Trader Joe's",
    tip: "If you don't have a TJ's near your base, stock up here. Game changer for hotel room meals.",
  },
  // Drinks
  {
    city: 'San Francisco',
    itemName: 'Blue Bottle single origin beans',
    category: 'drinks',
    storeName: 'Blue Bottle (Ferry Building)',
    tip: 'Started right here in SF. The Ferry Building location has the freshest beans. Grab a pour-over while you wait.',
  },
  {
    city: 'San Francisco',
    itemName: 'Philz Tesora coffee beans',
    category: 'drinks',
    storeName: 'Philz Coffee (any location)',
    tip: 'Mint Mojito is the cult favorite drink but Tesora beans for home brewing is the move. True SF staple.',
  },
  // Souvenirs
  {
    city: 'San Francisco',
    itemName: 'Golden Gate Bridge ornament',
    category: 'souvenirs',
    storeName: 'Golden Gate Bridge Gift Center',
    tip: 'Skip the Pier 39 tourist traps. The gift shop AT the bridge has nicer stuff and supports park maintenance.',
  },
  // Fashion
  {
    city: 'San Francisco',
    itemName: 'Patagonia Worn Wear jacket',
    category: 'fashion',
    storeName: 'Patagonia (North Beach)',
    tip: 'They have a Worn Wear (used) section with great deals. Perfect layover layers for cold overnights.',
  },
  // Wellness
  {
    city: 'San Francisco',
    itemName: 'Eucalyptus shower bundle',
    category: 'wellness',
    storeName: "Trader Joe's or Flower Mart",
    tip: "Hang it in your shower at the hotel — instant spa vibes. TJ's has them for like $4.",
  },
  {
    city: 'San Francisco',
    itemName: 'Epsom salt lavender soak',
    category: 'wellness',
    storeName: 'Walgreens or Rainbow Grocery',
    tip: 'Perfect after a long duty day. Fill up the hotel tub, add this, and you will sleep like a baby.',
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

export type SeedResult = {
  added: number;
  skipped: number;
  errors: number;
  details: { city: string; item: string; status: 'added' | 'skipped' | 'error' }[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function cityHasItems(city: string): Promise<boolean> {
  const q = query(
    collection(db, 'whatToBuy'),
    where('city', '==', city),
    where('status', '==', 'approved')
  );
  const snap = await getDocs(q);
  return snap.size >= 5;
}

// ─── Main seed function ─────────────────────────────────────────────────────

export async function seedWhatToBuy(
  userId: string,
  displayName: string
): Promise<SeedResult> {
  const result: SeedResult = {
    added: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // All seed items (currently just SFO — add more cities later)
  const allItems = [...SFO_ITEMS];

  // Check which cities already have data
  const citiesChecked = new Map<string, boolean>();

  for (const item of allItems) {
    // Check city once
    if (!citiesChecked.has(item.city)) {
      citiesChecked.set(item.city, await cityHasItems(item.city));
    }

    // Skip city if already seeded
    if (citiesChecked.get(item.city)) {
      result.skipped++;
      result.details.push({ city: item.city, item: item.itemName, status: 'skipped' });
      continue;
    }

    try {
      await addDoc(collection(db, 'whatToBuy'), {
        city: item.city,
        itemName: item.itemName,
        category: item.category,
        storeName: item.storeName || '',
        tip: item.tip,
        addedBy: userId,
        addedByName: displayName,
        upvotes: Math.floor(Math.random() * 5) + 1, // 1-5 to look organic
        upvotedBy: [userId],
        createdAt: serverTimestamp(),
        status: 'approved',
      });
      result.added++;
      result.details.push({ city: item.city, item: item.itemName, status: 'added' });
    } catch (error) {
      console.error('Error seeding:', item.itemName, error);
      result.errors++;
      result.details.push({ city: item.city, item: item.itemName, status: 'error' });
    }
  }

  return result;
}
