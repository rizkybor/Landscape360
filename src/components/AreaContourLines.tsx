import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/mapbox";
import type { FeatureCollection, LineString } from "geojson";
import { isIndexLine } from "../utils/contourGeo";
import type { AreaContourData } from "../types/markedArea";

export interface ContourSet {
  data: AreaContourData;
  intervalM: number | null;
}

// Contour lines saved with Marked Areas (uploaded on the web), drawn in topographic brown so
// they read apart from the map's own gold contour layer. Index lines are thicker and labelled.
export const AreaContourLines = ({ id, sets }: { id: string; sets: ContourSet[] }) => {
  const data = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: sets.flatMap(({ data, intervalM }) =>
        data.features.map((f) => ({
          ...f,
          properties: {
            elevation: f.properties?.elevation ?? null,
            // Without a known interval every line is drawn as an index line
            index: intervalM === null || isIndexLine(f.properties?.elevation ?? null, intervalM),
          },
        })),
      ),
    }),
    [sets],
  );

  if (!data.features.length) return null;
  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-line`}
        type="line"
        paint={{
          "line-color": "#8a5a2b",
          "line-width": ["case", ["get", "index"], 1.8, 0.9],
          "line-opacity": 0.9,
        }}
      />
      <Layer
        id={`${id}-label`}
        type="symbol"
        minzoom={12}
        filter={["all", ["get", "index"], ["!=", ["get", "elevation"], null]]}
        layout={{
          "symbol-placement": "line",
          "text-field": ["concat", ["to-string", ["get", "elevation"]], " m"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 10,
          "symbol-spacing": 300,
        }}
        paint={{ "text-color": "#6b4220", "text-halo-color": "#ffffff", "text-halo-width": 1.4 }}
      />
    </Source>
  );
};
