import { createLocationLink, getLocationLink, revokeLocationLink } from "../services/markedLocationSync";
import { buildPlaceShareText, placeLinkUrl } from "../lib/shareLocation";
import { CATEGORY_META } from "../utils/markedLocations";
import type { MarkedLocation } from "../types/markedLocation";
import { ShareLinkBox } from "./ShareLinkBox";

// Share one marked location as a link (e.g. on WhatsApp): whoever opens it sees that
// location on the map without signing in. The owner can turn the link off at any time.
export const MarkedLocationLinkShare = ({ location }: { location: MarkedLocation }) => (
  <ShareLinkBox
    key={location.id}
    what="this location"
    getToken={() => getLocationLink(location.id)}
    createToken={() => createLocationLink(location.id)}
    revoke={() => revokeLocationLink(location.id)}
    urlFor={placeLinkUrl}
    messageFor={(url) =>
      buildPlaceShareText(
        {
          name: location.name,
          categoryLabel: CATEGORY_META[location.category]?.label ?? location.category,
          lat: location.lat,
          lng: location.lng,
          elevationM: location.elevationM,
        },
        url,
      )
    }
  />
);
