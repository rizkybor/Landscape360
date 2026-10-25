import {
  Binoculars,
  DoorOpen,
  Droplets,
  Flag,
  House,
  MapPin,
  Mountain,
  SquareParking,
  Tent,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { MarkedLocationCategory } from '../types/markedLocation';

// One icon per category, used in the list, the form, the map markers and the popup
export const CATEGORY_ICONS: Record<MarkedLocationCategory, LucideIcon> = {
  poi: MapPin,
  camp: Tent,
  summit: Mountain,
  water: Droplets,
  shelter: House,
  viewpoint: Binoculars,
  trailhead: Flag,
  hazard: TriangleAlert,
  cave: DoorOpen,
  parking: SquareParking,
};
