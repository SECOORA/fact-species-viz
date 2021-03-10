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

function MapGrid(props) {
  const keys = useMemo(() => {
    return props.months.flatMap((m) => {
      return props.variants.map((v) => {
        return `${props.trackercode}_2018_${m}_${v}`;
      });
    });
  }, [props.months, props.variants, props.trackercode]);

  // let keys = [
  //   "BLKTP_2018_5",
  //   "BLKTP_2018_5_FULL",
  //   "BLKTP_2018_6",
  //   "BLKTP_2018_6_FULL",
  // ];

  return (
    <div className="mapgrid-4up">
      {keys.map((k) => {
        return (
          <div key={k}>
            <h3>{k}</h3>
            <GLMap
              idField="key"
              mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
              mapHeight={320}
              mapWidth={320}
              layerSources={{
                url: `//localhost:7006/${k}.geojson`,
                transform: (d) => {
                  let data;
                  
                  if (d.features[0].geometry.type === "MultiPoint") {
                    data = {points: d.features[0]}
                  } else {
                    data = {range: d.features[0]}
                  }

                  let
                    catalog = [
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
                        normal: normalStyle
                      },
                      points: {
                        normal: pointStyle
                      }
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
