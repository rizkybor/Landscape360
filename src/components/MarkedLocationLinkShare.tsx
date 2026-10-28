import type { MarkedLocation } from "../types/markedLocation";
import { ShareLinkBox } from "./ShareLinkBox";

// Share one marked location as a link: made in the mobile app (see ShareLinkBox)
export const MarkedLocationLinkShare = ({ location }: { location: MarkedLocation }) => (
  <ShareLinkBox key={location.id} what="this location" />
);
