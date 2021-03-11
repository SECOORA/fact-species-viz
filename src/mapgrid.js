import React, {useState, useMemo, useEffect} from "react";
import ReactDOM from "react-dom";
import bbox from "@turf/bbox";

import GLMap from "./glmap.js";

const normalStyle = {
  type: "fill",

  paint: {
    "fill-color": "#fcc87f",
    "fill-opacity": 0.5,
    "fill-outline-color": "#f6a577"
  },
};

const pointStyle = {
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 10, 10],
    "circle-stroke-width": 2,
    "circle-pitch-alignment": "map",
    "circle-color": "#fcc87f",
    "circle-stroke-color": "#f6a577"
  }
}

const DEFAULT_VARIANTS = [
  "FULL",
  "FULL_concave",
  "FULL_convex",
  "FULL_rbbox",
  "ANIM_BOXES",
];

function MapGrid(props) {
  const mapHeight = props.mapHeight || 320;


  const keys = useMemo(() => {
    let variantPairs = DEFAULT_VARIANTS.map(variant => {
      return [
        variant,
        props.years.flatMap((y) => {
          return props.months.flatMap((m) => {
            return `${props.trackercode}_${y}_${m}_${variant}`;
          });
        }),
      ];
    })

    return Object.fromEntries(variantPairs);
  }, [props.months, props.variants, props.trackercode, props.years]);

  return (
    <div className="mapgrid-4up">
      {DEFAULT_VARIANTS.map((k) => {
        return (
          <div className="relative" style={{ maxHeight: mapHeight }} key={k}>
            <h3 className="absolute top-0 left-0 font-bold z-50">{k}</h3>
            <GLMap
              idField="key"
              mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
              mapHeight={mapHeight}
              mapWidth={mapHeight}
              maxZoom={4}
              layerSources={{
                url: `//localhost:7006/${keys[k]}.geojson`,
                transform: (d) => {
                  let data;

                  if (d.features.length === 0) {
                    return null;
                  }

                  if (d.features[0].geometry.type === "MultiPoint") {
                    data = { points: d.features[0] };
                  } else {
                    data = { range: d.features[0] };
                  }

                  let catalog = [
                    {
                      key: k,
                      boundingBox: bbox(d.features[0]),
                      data: data,
                    },
                  ];

                  return {
                    name: k,
                    styles: {
                      range: {
                        normal: normalStyle,
                      },
                      points: {
                        normal: pointStyle,
                      },
                    },
                    catalog: catalog,
                  };
                },
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default MapGrid;
