// utils/whatToBuy.ts
// Firestore helpers for the "What to Buy" feature.
//
// Collection: whatToBuy
// Each doc represents a crew-recommended product or item to buy in a city.
//
// Fields:
//   city         — city name (matches spots city field)
//   itemName     — product or item name (e.g. "Olio Verde Olive Oil")
//   category     — wine | skincare | groceries | souvenirs | snacks | drinks | fashion | wellness | other
//   storeName    — optional store or shop name
//   tip          — crew tip or description
//   addedBy      — user uid
//   addedByName  — display name
//   upvotes      — number of crew who agree
//   upvotedBy    — array of uids who upvoted
//   createdAt    — timestamp
//   status       — approved | pending (for future moderation)

import { db } from '@/config/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BuyCategory =
  | 'wine'
  | 'skincare'
  | 'groceries'
  | 'souvenirs'
  | 'snacks'
  | 'drinks'
  | 'fashion'
  | 'wellness'
  | 'other';

export type BuyItem = {
  id: string;
  city: string;
  itemName: string;
  category: BuyCategory;
  storeName?: string;
  tip: string;
  addedBy: string;
  addedByName: string;
  upvotes: number;
  upvotedBy: string[];
  createdAt: any;
  status: 'approved' | 'pending';
};

// ─── Category metadata ──────────────────────────────────────────────────────

export const BUY_CATEGORIES: {
  id: BuyCategory;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { id: 'wine',      label: 'Wine & Spirits', emoji: '🍷', color: '#8B1A4A' },
  { id: 'skincare',  label: 'Skincare',       emoji: '🧴', color: '#E88D9D' },
  { id: 'groceries', label: 'Groceries',      emoji: '🛒', color: '#4CAF50' },
  { id: 'snacks',    label: 'Snacks',         emoji: '🍫', color: '#FF9800' },
  { id: 'drinks',    label: 'Drinks',         emoji: '🥤', color: '#2196F3' },
  { id: 'souvenirs', label: 'Souvenirs',      emoji: '🎁', color: '#9C27B0' },
  { id: 'fashion',   label: 'Fashion',        emoji: '👗', color: '#607D8B' },
  { id: 'wellness',  label: 'Wellness',       emoji: '💊', color: '#00BCD4' },
  { id: 'other',     label: 'Other',          emoji: '✨', color: '#795548' },
];

export function getCategoryMeta(categoryId: BuyCategory) {
  return BUY_CATEGORIES.find(c => c.id === categoryId) || BUY_CATEGORIES[BUY_CATEGORIES.length - 1];
}

// ─── Fetch items for a city ─────────────────────────────────────────────────

export async function fetchWhatToBuy(cityName: string): Promise<BuyItem[]> {
  try {
    const q = query(
      collection(db, 'whatToBuy'),
      where('city', '==', cityName),
      where('status', '==', 'approved'),
      orderBy('upvotes', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BuyItem[];
  } catch (error) {
    console.error('fetchWhatToBuy error:', error);
    return [];
  }
}

// ─── Add a new item ─────────────────────────────────────────────────────────

export async function addBuyItem(params: {
  city: string;
  itemName: string;
  category: BuyCategory;
  storeName?: string;
  tip: string;
  addedBy: string;
  addedByName: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, 'whatToBuy'), {
    ...params,
    upvotes: 0,
    upvotedBy: [],
    createdAt: serverTimestamp(),
    status: 'approved', // Auto-approve for now; add moderation later
  });

  return docRef.id;
}

// ─── Toggle upvote ──────────────────────────────────────────────────────────

export async function toggleUpvote(itemId: string, userId: string, currentlyUpvoted: boolean): Promise<void> {
  const ref = doc(db, 'whatToBuy', itemId);

  if (currentlyUpvoted) {
    await updateDoc(ref, {
      upvotes: increment(-1),
      upvotedBy: arrayRemove(userId),
    });
  } else {
    await updateDoc(ref, {
      upvotes: increment(1),
      upvotedBy: arrayUnion(userId),
    });
  }
}

// ─── Delete an item (owner or admin) ────────────────────────────────────────

export async function deleteBuyItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'whatToBuy', itemId));
}
