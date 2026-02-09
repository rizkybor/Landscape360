import { Map } from "mapbox-gl";
import { MAPBOX_TOKEN } from "../config";

/**
 * Retrieves the elevation at a specific coordinate with a robust retry strategy.
 * 
 * Strategy:
 * 1. Direct Client-Side Query: Fast, uses loaded terrain tiles.
 * 2. Offset Client-Side Query: Handles tile boundary edge cases.
 * 3. Async Retry: Waits for potential render/load completion.
 * 4. API Fallback: Fetches directly from Mapbox Tilequery API (ultimate source of truth).
 */
export async function getElevationAtPoint(
    map: Map, 
    lng: number, 
    lat: number
): Promise<number> {
    // 1. Helper for Local Query
    const queryLocal = () => {
        if (!map.isStyleLoaded()) return null;
        
        // Direct
        let elev = map.queryTerrainElevation({ lng, lat });
        
        // Offset (if 0 or null)
        if (elev === null || elev === undefined || elev === 0) {
             const offset = 0.00001;
             const elevOffset = map.queryTerrainElevation({ lng: lng + offset, lat: lat + offset });
             if (elevOffset !== null && elevOffset !== undefined && elevOffset !== 0) {
                 elev = elevOffset;
             }
        }
        return elev;
    };

    // Attempt 1: Immediate
    let elevation = queryLocal();

    // Attempt 2: Short delay (Async Retry)
    if (elevation === null || elevation === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        elevation = queryLocal();
    }

    // Attempt 3: API Fallback
    // Only if local failed (still 0 or null) and we are online
    if ((elevation === null || elevation === 0) && navigator.onLine) {
        try {
            const response = await fetch(
                `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/tilequery/${lng},${lat}.json?limit=1&access_token=${MAPBOX_TOKEN}`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                    const props = data.features[0].properties;
                    // Mapbox Terrain-RGB decoding
                    // height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
                    if (props) {
                        const { r, g, b } = props;
                        if (r !== undefined && g !== undefined && b !== undefined) {
                             elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn("API Elevation fetch failed:", err);
        }
    }

    // Final check: if everything failed, return 0 (sea level) but ensure it's a number
    return (elevation !== null && elevation !== undefined) ? elevation : 0;
}
