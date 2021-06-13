import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import bbox from "@turf/bbox";

import GLMap from "./glmap.js";
import DataLayer from "./dataLayer.js";


function DistMap(props) {
  const mapHeight = props.mapHeight || 320;

  return (
    <GLMap
      idField="key"
      mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
      // mapStyle="mapbox://styles/mz4/ck6kzovim17x91iqv3rv1h7u4"
      mapHeight={mapHeight}
      mapWidth={mapHeight}
      maxZoom={4}
    >
      <DataLayer aphiaId={props.aphiaId} year={props.year} palette={props.palette} beforeId={props.beforeId || 'z-1'} month={props.month} project={props.project} />
    </GLMap>
  );
}

export default DistMap;