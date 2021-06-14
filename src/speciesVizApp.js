import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import {useLocation, useHistory} from 'react-router';
import axios from "axios";
import _ from 'lodash';

import GLMap from "./glmap.js";
import DataLayer from "./dataLayer.js";
import LayerTile from "./layerTile.js";
import LayerEditor from "./layerEditor.js";

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
      layerKey: "ooba",
      aphiaId: 159353,
      year: 2016,
      project: "_ALL",
      month: 6,
      palette: "reds_r",
    },
    {
      layerKey: "oajj",
      aphiaId: 159353,
      year: 2015,
      project: "_ALL",
      month: 6,
      palette: "purples_r",
    },
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

  const onLayerUpdate = (newLayer) => {
    const newLayerData = layerData.map((ld, idx) => {
      if (idx != activeIdx) {
        return ld;
      }
      return newLayer;
    });

    setLayerData(ld => newLayerData);
  }

  const addLayer = () => {
    if (layerData.length >= 5) { return; }

    setLayerData(ld => {
      return [
        {
          ...ld[0],    // @TODO: variety
          layerKey: `oo-${Math.random()}`,
          year: ld[0].year + 1
        },
        ...ld
      ]
    });
    setActiveIdx(0);
  }

  return (
    <div>
      <div className="flex">
        <GLMap
          idField="key"
          mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
          // mapStyle="mapbox://styles/mz4/ck6kzovim17x91iqv3rv1h7u4"
          mapHeight={700}
          mapWidth={700}
          maxZoom={4}
        >
          {layerData.map((ld, idx) => {
            return (
              <DataLayer
                key={ld.layerKey}
                beforeId={`z-${4 - idx}`}
                aphiaId={ld.aphiaId}
                year={ld.year}
                palette={ld.palette}
                month={ld.month}
                project={ld.project}
                layerKey={ld.layerKey}
              />
            );
          })}
        </GLMap>
        <div className="relative">
          <div
            className="tileholder flex flex-col absolute"
            style={{ left: "-16rem" }}
          >
            <div
              className="w-16 h-16 bg-indigo-700 self-end text-4xl cursor-pointer text-white"
              onClick={addLayer}
            >
              +
            </div>

            {layerData.map((ld, idx) => {
              return (
                <LayerTile
                  key={`lt-${idx}`}
                  onClick={() => setActiveIdx(idx)}
                  isActive={idx === activeIdx}
                  {...ld}
                />
              );
            })}
          </div>

          <LayerEditor
            notifyUpdate={onLayerUpdate}
            currentLayer={layerData[activeIdx]}
            allAphiaIds={allAphiaIds}
            allSpeciesNames={allSpeciesNames}
            speciesProjects={speciesProjects}
            availYears={availYears}
            availMonths={availMonths}
          />
        </div>
      </div>
    </div>
  );
}

export default SpeciesVizApp;

