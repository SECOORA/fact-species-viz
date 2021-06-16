import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import {useLocation, useHistory} from 'react-router';
import axios from "axios";
import _ from 'lodash';

import GLMap from "./glmap.js";
import CitationModal from "./citationModal.js";
import DataLayer from "./dataLayer.js";
import LayerTile from "./layerTile.js";
import LayerEditor from "./layerEditor.js";
import Legend from "./legend.js";
import Palettes from "./palettes.js";
import {IconPlus} from "./icon.js";

const getRandomItem = (iterable) => iterable[Math.floor(Math.random() * iterable.length)]

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
}

function SpeciesVizApp(props) {

  let query = useQuery(),
    location = useLocation(),
    history = useHistory();

  const [dataInventory, setDataInventory] = useState([]);
  const [citations, setCitations] = useState({}); // project code -> {shortname, citation, website}
  const [maxLevels, setMaxLevels] = useState({}); // layerKey -> maximum
  const [layerData, setLayerData] = useState([
    {
      layerKey: "ooba",
      aphiaId: 105793,
      year: 2019,
      project: "_ALL",
      month: 'all',
      palette: "reds_r",
      type: "distribution",
    },
    // {
    //   layerKey: "ooba",
    //   aphiaId: 159353,
    //   year: 2016,
    //   project: "_ALL",
    //   month: 6,
    //   palette: "reds_r",
    //   type: "distribution"
    // },
    // {
    //   layerKey: "oajj",
    //   aphiaId: 159353,
    //   year: 2015,
    //   project: "_ALL",
    //   month: 6,
    //   palette: "purples_r",
    //   type: "distribution"
    // },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showCitations, setShowCitations] = useState([]);   // list of project codes

  const maxLevel = useMemo(() => {
    return Math.max(...Object.values(maxLevels));
  }, [maxLevels])

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
    async function getInventory() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/inventory`);
      setDataInventory(response.data);
    }
    getInventory();
  }, []);

  useEffect(() => {
    async function getCitations() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/citations`);
      setCitations(response.data);
    }
    getCitations();
  }, []);

  const speciesLookup = useMemo(() => {
    return _.fromPairs(dataInventory.map(di => {
      return [
        di.aphiaId,
        {
          commonName: di.speciesCommonName,
          scientificName: di.speciesScientificName
        }
      ]
    }))
  }, [dataInventory])

  const onLayerUpdate = (newLayer) => {
    const newLayerData = layerData.map((ld, idx) => {
      if (idx != activeIdx) {
        return ld;
      }
      return newLayer;
    });

    setLayerData(ld => newLayerData);
  }

  const addLayer = (srcIdx=0, randomPalette=true) => {
    if (layerData.length >= 5) { return; }

    setLayerData(ld => {
      let palette = ld[srcIdx].palette;
      if (randomPalette) {
        const usedPalettes = ld.map((ll) => ll.palette);
        palette = getRandomItem(
          Object.keys(Palettes).filter((p) => usedPalettes.indexOf(p) === -1)
        );
      }

      const newData = [
        {
          ...ld[srcIdx],
          layerKey: `oo-${Math.random().toString(36).substring(7)}`,
          palette: palette,
        },
        ...ld,
      ];
      return newData;
    });
    setActiveIdx(0);
  }

  const updateLegendLevel = (level, layerKey) => {
    setMaxLevels(curMaxLevels => {
      return {
        ...curMaxLevels,
        [layerKey]: level
      }
    });
  }

  /**
   * Moves the layer indicated by index in the direction given.
   * Won't do anything if that moves the layer out of bounds.
   * @param {*} idx 
   * @param {*} direction 
   */
  const moveLayer = (idx, direction) => {
    // can't go lower than the first layer
    if (idx === 0 && direction === -1) {
      return;
    }

    // can't go beyond the last layerdata
    if (idx === layerData.length - 1 && direction === 1) {
      return;
    }

    const targetIdx = idx + direction;


    setLayerData(ld => {
      const copy = [...ld];
      copy.splice(targetIdx, 0, copy.splice(idx, 1)[0]);
      return copy;
    })

    // is the active index affected by the move?  move along with it
    if (activeIdx === idx) {
      // if you're the source, you move in the same direction
      setActiveIdx(activeIdx + direction);
    } else if (activeIdx === targetIdx) {
      // if you're the target, you move in the opposite direction
      setActiveIdx(activeIdx + (-direction));
    }
  }

  /**
   * Deletes a layer with the given index.
   * @param {int} idx 
   */
  const deleteLayer = (idx) => {
    if (layerData.length <= 1) {
      return;
    }

    // make sure we remove the scale levels for this layer
    setMaxLevels(curMaxLevels => {
      return _.omit(curMaxLevels, layerData[idx].layerKey);
    });

    setLayerData(ld => {
      const copy = [...ld];
      copy.splice(idx, 1);
      return copy;
    })
  }

  return (
    <div className="relative">
      <div className="flex">
        <GLMap
          idField="key"
          mapStyle="mapbox://styles/mz4/ck6m8v8x9052n1iphvif4ilra"
          // mapStyle="mapbox://styles/mz4/ck6kzovim17x91iqv3rv1h7u4"
          mapHeight={700}
          mapWidth={700}
          maxZoom={4}
          overlayComponents={
            <div className="mt-2 ml-2">
              <Legend
                maxLevel={maxLevel}
                palettes={layerData.map((ld) => ld.palette)}
              />
            </div>
          }
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
                opacity={ld.opacity}
                updateLegendLevel={updateLegendLevel}
                maxLevel={maxLevel}
                type={ld.type}
              />
            );
          })}
        </GLMap>
        <div className="relative">
          <div
            className="tileholder flex flex-col absolute"
            style={{ left: "-16rem" }}
          >
            <div className="w-16 h-16 bg-indigo-700 self-end text-4xl cursor-pointer text-white flex justify-center">
              <IconPlus
                extraClasses="flex-grow hover:text-indigo-200"
                size="full"
                onClick={() => {
                  addLayer();
                }}
              />
            </div>

            {layerData.map((ld, idx) => {
              return (
                <LayerTile
                  key={`lt-${idx}`}
                  onClick={() => setActiveIdx(idx)}
                  isActive={idx === activeIdx}
                  {...ld}
                  speciesName={speciesLookup[ld.aphiaId]?.commonName}
                  onLayerUp={() => moveLayer(idx, -1)}
                  onLayerDown={() => moveLayer(idx, 1)}
                  enableLayerUp={idx > 0}
                  enableLayerDown={idx < layerData.length - 1}
                  onLayerDelete={() => deleteLayer(idx)}
                  enableDelete={layerData.length > 1}
                  onLayerDuplicate={() => addLayer(idx, false)}
                  enableDuplicate={layerData.length < 5}
                />
              );
            })}
          </div>

          <LayerEditor
            notifyUpdate={onLayerUpdate}
            currentLayer={layerData[activeIdx]}
            dataInventory={dataInventory}
            citations={citations}
            onShowCitations={(codes) => setShowCitations(codes)}
          />
        </div>
      </div>

      {showCitations.length > 0 && (
        <CitationModal
          citations={citations}
          showCitations={showCitations}
          onClose={() => setShowCitations([])}
        />
      )}
    </div>
  );
}

export default SpeciesVizApp;

