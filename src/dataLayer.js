import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import {Source, Layer } from 'react-map-gl';
import useSWR from "swr";
import axios from "axios";

import Palettes from "./palettes.js";

const getStyle = (paletteName = "thermal") => {
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
};
const fetcher = (url) => axios.get(url).then((res) => res.data);

const useDistribution = (
  aphiaId,
  year,
  type = "distribution",
  month = "all",
  project = "_ALL"
) => {
  const url = useMemo(() => {
    let start = `${process.env.DATA_URL}/atp/${aphiaId}/${type}/${year}`,
      extra = [];
    if (month !== "all") {
      extra.push(`month=${month}`);
    }
    if (project !== "_ALL") {
      extra.push(`project=${project}`);
    }
    if (extra.length) {
      start += "?" + extra.join("&");
    }

    return start;
  }, [aphiaId, year, type, month, project]);

  const { data, error } = useSWR(url, fetcher);

  return {
    data: data,
    isLoading: !error && !data,
    isError: error,
  };
};

const DataLayer = ({
  aphiaId,
  year,
  month = "all",
  project = "_ALL",
  palette = "thermal",
  beforeId = "z-0",
}) => {
  const { data, isLoading, isError } = useDistribution(
    aphiaId,
    year,
    "distribution",
    month,
    project
  );

  const layerName = useMemo(() => {
    return `dist-${aphiaId}-${year}`;
  }, [aphiaId, year]);

  const normalStyle = useMemo(() => {
    return getStyle(palette);
  }, [palette]);

  if (!isLoading && !isError) {
    return (
      <Source
        id={`src-${layerName}`}
        type="geojson"
        data={data}
        key={layerName}
      >
        <Layer id={layerName} beforeId={beforeId} {...normalStyle} />
      </Source>
    );
  } else {
    return null;
  }
};

export default DataLayer;