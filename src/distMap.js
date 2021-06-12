import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import bbox from "@turf/bbox";

import GLMap from "./glmap.js";
import Palettes from "./palettes.js";
import axios from "axios";

const getStyle = (paletteName="thermal") => {
  return {
    type: "fill",

    paint: {
      "fill-opacity": 0.5,
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "local_pct"],
        ...Palettes[paletteName],
      ],
    },
  };
}

function DistMap(props) {
  const mapHeight = props.mapHeight || 320;

  const [gjData, setGjData] = useState({}); 

  useEffect(() => {
    async function getData() {
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

      const response = await axios.get(start);
      setGjData({
        dist: response.data,
      });
    }

    getData();
  }, [props.aphiaId, props.year, props.month, props.project]);

  const normalStyle = useMemo(() => {
    return getStyle(props.palette);
  }, [props.palette]);

  return (
    <GLMap
      idField="key"
      mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
      // mapStyle="mapbox://styles/mz4/ck6kzovim17x91iqv3rv1h7u4"
      mapHeight={mapHeight}
      mapWidth={mapHeight}
      maxZoom={4}
      styles={{ dist: {normal: normalStyle}}}
      layerData={gjData}
    />
  );
}

export default DistMap;