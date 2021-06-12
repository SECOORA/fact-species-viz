import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import bbox from "@turf/bbox";

import GLMap from "./glmap.js";
import Palettes from "./palettes.js";

const pointStyle = {
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 10, 10],
    "circle-stroke-width": 2,
    "circle-pitch-alignment": "map",
    "circle-color": "#fcc87f",
    "circle-stroke-color": "#f6a577",
  },
};

function DistMap(props) {
  const mapHeight = props.mapHeight || 320;
  const url = useMemo(() => {
    let start = `${process.env.DATA_URL}/atp/${props.aphiaId}/distribution/${props.year}`,
      extra = [];
    if (props.month !== 'all') {
      extra.push(`month=${props.month}`);
    }
    if (props.project !== '_ALL') {
      extra.push(`project=${props.project}`);
    }
    if (extra.length) {
      start += '?' + extra.join("&");
    }

    return start;
    
  }, [props.aphiaId, props.year, props.month, props.project]);

  const normalStyle = useMemo(() => {
    return {
      type: "fill",

      paint: {
        "fill-opacity": 0.5,
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "local_pct"],
          ...Palettes[props.palette || "thermal"],
        ],
      },
    };
  }, [props.palette]);

  return (
    <GLMap
      idField="key"
      mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
      // mapStyle="mapbox://styles/mz4/ck6kzovim17x91iqv3rv1h7u4"
      mapHeight={mapHeight}
      mapWidth={mapHeight}
      maxZoom={4}
      layerSources={{
        url: url,
        transform: (d) => {
          let data;

          if (d.features.length === 0) {
            return null;
          }

          const catalog = d.features.map((feat, idx) => {
            return {
              key: `dist`,
              boundingBox: bbox(feat),
              data: {
                range: feat,
              },
            };
          });

          return {
            name: 'dist',
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
  );
}

export default DistMap;