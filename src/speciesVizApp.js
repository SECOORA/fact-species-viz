import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {useLocation, useHistory} from 'react-router';
import axios from "axios";
import _ from 'lodash';

import GLMap from "./glmap.js";
import DataLayer from "./dataLayer.js";
import Chooser from "./chooser.js";
import Palettes from "./palettes.js";

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
}

function SpeciesVizApp(props) {

  let query = useQuery(),
    location = useLocation(),
    history = useHistory();

  // TODO: replace with inventory
  const [allAphiaIds, setAllAphiaIds] = useState([]);
  const [allSpeciesNames, setAllSpeciesNames] = useState([]);
  const [speciesProjects, setSpeciesProjects] = useState([]);
  const [availYears, setAvailYears] = useState([]);
  const [availMonths, setAvailMonths] = useState([]);

  const [layerData, setLayerData] = useState([
    {
      aphiaId: 159353,
      year: 2016,
      project: '_ALL',
      month: 'all',
      palette: 'thermal'
    }
  ]);
  const [activeIdx, setActiveIdx] = useState(0);

  const buildQueryString = (newArgs) => {
    let {newMonth = month, newYear = year, newAphiaId = aphiaId} = newArgs;

    let vals = {
      month: newMonth,
      year: newYear,
      aphiaId: newAphiaId
    }

    let kvp = Object.entries(vals).map(kv => kv.join("=")).join("&");
    let temp = `?${kvp}`;

    return temp;
  }

  // // handle any url params controlling state
  // useEffect(() => {
  //   if (query.has("aphiaId")) {
  //     const aphiaId = parseInt(query.get("aphiaId"));
  //     setAphiaId(aphiaId);
  //   }

  //   if (query.has("month")) {
  //     let m = query.get("month");
  //     if (m !== "all") {
  //       m = parseInt(m);
  //     }
  //     setMonth(m);
  //   }

  //   if (query.has("year")) {
  //     setYear(parseInt(query.get("year")));
  //   }
  // }, [location])

  useEffect(() => {
    async function getAphiaIds() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/species`);
      const [aphiaIds, names] = _.unzip(_.map(response.data, (v, k) => [parseInt(k), v]));
      setAllAphiaIds(aphiaIds);
      setAllSpeciesNames(names);
    }

    getAphiaIds();
  }, []);

  useEffect(() => {
    setSpeciesProjects([]);

    async function getProjects() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/projects/${layerData[activeIdx].aphiaId}`);
      setSpeciesProjects(response.data)
    }

    getProjects();
  }, [layerData[activeIdx].aphiaId])

  useEffect(() => {
    async function getYears() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/species/${layerData[activeIdx].aphiaId}/years`);
      setAvailYears(response.data)
    }

    getYears();
  }, [layerData[activeIdx].aphiaId])

  useEffect(() => {
    async function getMonths() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/species/${layerData[activeIdx].aphiaId}/${layerData[activeIdx].year}`);
      setAvailMonths(response.data)
    }

    getMonths();
  }, [layerData[activeIdx].aphiaId, layerData[activeIdx].year])

  const _updateLayer = (value) => {
    const newLayerData = layerData.map((ld, idx) => {
      if (idx != activeIdx) {
        return ld;
      }
      return {
        ...ld,
        ...value
      }
    });

    setLayerData(curLd => newLayerData);
  }

  return (
    <div className="mr-12">
      <nav>
        <h1 className="text-2xl ml-24 mb-2 pl-1">
          <a href="/">FACT DaViT</a>
        </h1>
        <Chooser
          items={allAphiaIds}
          labels={allSpeciesNames}
          onClick={v => _updateLayer({aphiaId: v, project: '_ALL'})}    // always reset project when changing species
          curVal={layerData[activeIdx].aphiaId}
          label="Species"
        />

        <Chooser
          items={["_ALL", ...speciesProjects]}
          onClick={v => _updateLayer({project: v})}
          curVal={layerData[activeIdx].project}
          label="Project"
        />

        <Chooser
          items={[
            2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
            2020,
          ]}
          enabledItems={availYears}
          onClick={v => _updateLayer({year: v})}
          curVal={layerData[activeIdx].year}
          label="Year"
        />

        <Chooser
          items={[...Array(12).keys(), "all"].map((m) =>
            m !== "all" ? m + 1 : m
          )}
          enabledItems={[...availMonths, "all"]}
          onClick={v => _updateLayer({month: v})}
          curVal={layerData[activeIdx].month}
          label="Month"
        />

        <Chooser
          items={Object.keys(Palettes)}
          onClick={v => _updateLayer({palette: v})}
          curVal={layerData[activeIdx].palette}
          label="Palette"
        />
      </nav>

      <GLMap
        idField="key"
        mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
        // mapStyle="mapbox://styles/mz4/ck6kzovim17x91iqv3rv1h7u4"
        mapHeight={700}
        mapWidth={700}
        maxZoom={4}
      >
        {layerData.map((ld, idx) => {
          return <DataLayer
            key={`layer-${idx}`}
            beforeId={`z-${idx}`}
            aphiaId={ld.aphiaId}
            year={ld.year}
            palette={ld.palette}
            month={ld.month}
            project={ld.project}
          />;
        })}
      </GLMap>
    </div>
  );
}

export default SpeciesVizApp;

