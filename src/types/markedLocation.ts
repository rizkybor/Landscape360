// Keep in sync with the category check in 20261024000003_create_marked_locations.sql
export const MARKED_LOCATION_CATEGORIES = [
  'poi',
  'camp',
  'summit',
  'water',
  'shelter',
  'viewpoint',
  'trailhead',
  'hazard',
  'cave',
  'parking',
] as const;

export type MarkedLocationCategory = (typeof MARKED_LOCATION_CATEGORIES)[number];

export interface MarkedLocation {
  id: string;
  userId: string;
  name: string;
  category: MarkedLocationCategory;
  lng: number;
  lat: number;
  elevationM: number | null;
  description: string | null;
  address: string | null;
  contact: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// Editable fields of a location
export type MarkedLocationInput = Pick<
  MarkedLocation,
  'name' | 'category' | 'lng' | 'lat' | 'elevationM' | 'description' | 'address' | 'contact' | 'tags'
>;

// A location someone else shared with me
export interface SharedMarkedLocation extends MarkedLocation {
  ownerName: string | null;
  ownerEmailMasked: string | null;
  sharedAt: number;
}

// Admin view of any account's location
export interface AdminMarkedLocation extends MarkedLocation {
  ownerName: string | null;
  ownerEmail: string | null;
}

// A recipient of one of my locations
export interface MarkedLocationShare {
  userId: string;
  name: string | null;
  emailMasked: string | null;
  sharedAt: number;
}

// Someone to share with: a recent recipient, or an account matching what was typed
export interface ShareSuggestion {
  userId: string;
  name: string | null;
  emailMasked: string | null;
  recent: boolean;
}

export interface ShareResult {
  userId: string;
  name: string | null;
  emailMasked: string | null;
  sharedCount: number;
}
