import React, {useState, useMemo, useEffect} from "react";
import ReactDOM from "react-dom";
import bbox from "@turf/bbox";

import GLMap from "./glmap.js";

const fillRain = [
  0.0,
  "rgba(238,237,243,255)",
  0.1,
  "rgba(222,211,201,255)",
  0.2,
  "rgba(203,186,152,255)",
  0.3,
  "rgba(161,172,130,255)",
  0.4,
  "rgba(115,157,117,255)",
  0.5,
  "rgba(61,142,110,255)",
  0.6,
  "rgba(12,123,110,255)",
  0.7,
  "rgba(8,99,107,255)",
  0.8,
  "rgba(30,75,95,255)",
  0.9,
  "rgba(37,51,75,255)",
];

const fillThermal = [
  0.0,
  "rgba(4,35,51,255)",
  0.1,
  "rgba(15,50,106,255)",
  0.2,
  "rgba(64,52,159,255)",
  0.3,
  "rgba(103,67,150,255)",
  0.4,
  "rgba(139,83,141,255)",
  0.5,
  "rgba(177,95,130,255)",
  0.6,
  "rgba(214,108,108,255)",
  0.7,
  "rgba(243,130,77,255)",
  0.8,
  "rgba(252,166,60,255)",
  0.9,
  "rgba(247,208,69,255)",
];

const fillThermalR = [
  0.0,
  "rgba(232,250,91,255)",
  0.1,
  "rgba(247,208,69,255)",
  0.2,
  "rgba(252,166,60,255)",
  0.3,
  "rgba(243,130,77,255)",
  0.4,
  "rgba(214,108,108,255)",
  0.5,
  "rgba(175,95,130,255)",
  0.6,
  "rgba(139,83,141,255)",
  0.7,
  "rgba(103,67,150,255)",
  0.8,
  "rgba(64,52,159,255)",
  0.9,
  "rgba(15,50,106,255)",
];

const normalStyle = {
  type: "fill",

  paint: {
    // "fill-color": "#fcc87f",
    "fill-opacity": 0.5,
    // "fill-outline-color": "#f6a577"
    "fill-color": [
      "interpolate",
      ["linear"],
      ["get", "pct"],
      ...fillThermal
    ],
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
    let variantPairs = (props.variants || DEFAULT_VARIANTS).map(variant => {
      return [
        variant,
        props.years.flatMap((y) => {
          return props.months.flatMap((m) => {
            return {
              aphiaId: props.aphiaId,
              year: y,
              month: m,
              type: variant

            } //`${props.trackercode}_${y}_${m}_${variant}`;
          });
        }),
      ];
    })

    return Object.fromEntries(variantPairs);
  }, [props.months, props.variants, props.aphiaId, props.years]);

  return (
    <div className="mapgrid">
      {(props.variants || DEFAULT_VARIANTS).map((k, kk) => {
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
                url: `${process.env.DATA_URL}/atp/${keys[k].aphiaId}/${keys[k].type}/${keys[k].year}?month=${keys[k].month}`,
                transform: (d) => {
                  let data;

                  if (d.features.length === 0) {
                    return null;
                  }

                  const catalog = d.features.map((feat, idx) => {
                    return {
                      key: `${kk}-${idx}`,
                      boundingBox: bbox(feat),
                      data: {
                        range: feat
                      }
                    }
                  })

                  // if (d.features[0].geometry.type === "MultiPoint") {
                  //   data = { points: d.features[0] };
                  // } else {
                  //   data = { range: d.features[0] };
                  // }

                  // let catalog = [
                  //   {
                  //     key: k,
                  //     boundingBox: bbox(d.features[0]),
                  //     data: data,
                  //   },
                  // ];

                  return {
                    name: kk,
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
