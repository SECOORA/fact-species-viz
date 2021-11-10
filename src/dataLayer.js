import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import {Source, Layer } from 'react-map-gl';
import useSWR from "swr";
import axios from "axios";

import Palettes from "./palettes.js";

const getStyle = (paletteName = "thermal", opacity=100, maxLevel=10) => {
  return {
    type: "fill",

    paint: {
      "fill-opacity": opacity/100,
      "fill-color": [
        "interpolate",
        ["linear"],
        ["/", ["get", "level"], maxLevel],
        // ["get", "local_pct"],
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

  const { data, error } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    errorRetryCount: 1,
  });

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
  beforeId = "tw-z-0",
  opacity = 50,
  layerKey,
  updateLegendLevel,
  updateShownProjects,
  maxLevel = 10,
  type = 'distribution'
}) => {
  const { data, isLoading, isError } = useDistribution(
    aphiaId,
    year,
    type,
    month,
    project
  );

  const normalStyle = useMemo(() => {
    return getStyle(palette, opacity, maxLevel);
  }, [palette, opacity, maxLevel]);

  // notify application of current max level for this data layer
  useEffect(() => {
    if (!data || !updateLegendLevel) {
      return;
    }
    const maxLevel = Math.max(...data.features.map(f => f.properties.level));
    updateLegendLevel(maxLevel, layerKey);
  }, [data]);

  // notify application of all projects currently being displayed on this data layer
  useEffect(() => {
    if (!data || !updateShownProjects) {
      return;
    }
    if (data.features.length < 1) {
      return;
    }

    const projectCodes = data.features[0].properties.project_codes.split(",").map(p => p.trim());
    updateShownProjects(projectCodes, layerKey);
  }, [data]);

  if (!isLoading && !isError) {
    return (
      <Source
        id={`src-${layerKey}`}
        type="geojson"
        data={data}
        key={layerKey}
      >
        <Layer id={layerKey} beforeId={beforeId} {...normalStyle} />
      </Source>
    );
  } else {
    return null;
  }
};

export default DataLayer;