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
import PaletteSwatch from "./paletteSwatch.js";
import BaseStyles from "./baseStyles.js";
import {IconPlus} from "./icon.js";

import { Popup } from "react-map-gl";
import { objectTypeAnnotation } from "@babel/types";


const getRandomItem = (iterable) => iterable[Math.floor(Math.random() * iterable.length)]

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
}

function SpeciesVizApp(props) {

  let query = useQuery(),
    location = useLocation(),
    history = useHistory();

  const [basemapStyle, setBasemapStyle] = useState('greyscale');
  const [dataInventory, setDataInventory] = useState([]);
  const [citations, setCitations] = useState({}); // project code -> {shortname, citation, website}
  const [maxLevels, setMaxLevels] = useState({}); // layerKey -> maximum
  const [shownProjects, setShownProjects] = useState({}); // layerKey -> [project codes]
  const [layerData, setLayerData] = useState([
    {
      layerKey: "ooba",
      aphiaId: 105793,
      year: 2017,
      project: "_ALL",
      month: 'all',
      palette: "viridis",
      type: "distribution",
    },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showCitations, setShowCitations] = useState([]);   // list of project codes
  const [readOnly, setReadOnly] = useState(false);      // removes interactive UI
  const [hoverData, setHoverData] = useState({});       // lat, lon, layers

  const maxLevel = useMemo(() => {
    return Math.max(...Object.values(maxLevels));
  }, [maxLevels]);

  const shownProjectCodes = useMemo(() => {
    return _.uniq(_.flatMap(Object.values(shownProjects)));
  }, [shownProjects]);

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

  const updateShownProjects = (projectCodes, layerKey) => {
    setShownProjects(curShownProjects => {
      return {
        ...curShownProjects,
        [layerKey]: projectCodes
      }
    })
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

    const newLength = layerData.length - 1;

    // make sure we remove the scale levels for this layer
    setMaxLevels(curMaxLevels => {
      return _.omit(curMaxLevels, layerData[idx].layerKey);
    });

    // also remove the shown project codes
    setShownProjects(curProjects => {
      return _.omit(curProjects, layerData[idx].layerKey);
    })

    setLayerData(ld => {
      const copy = [...ld];
      copy.splice(idx, 1);
      return copy;
    })

    // have to adjust the activeIdx if the delete makes it out of bounds
    if (activeIdx >= newLength) {
      setActiveIdx(newLength - 1);
    }
  }

  const hoverPopup = useMemo(() => {
    if (Object.keys(hoverData).length === 0) {
      return <></>
    }

    const selLayerKeys = hoverData.layers.map(l => l.id),
      selLayers = layerData.filter(ld => selLayerKeys.indexOf(ld.layerKey) !== -1),
      hasDists = selLayers.filter(ld => ld.type === 'distribution').length > 0,
      rangeWClass = hasDists ? 'tw-w-28' : '';

    return (
      <Popup
        tipSize={10}
        anchor="left"
        longitude={hoverData.lon}
        latitude={hoverData.lat}
        closeOnClick={false}
        closeButton={false}
        offsetLeft={5}
        offsetTop={0}
        className={"glmap-popup"}
      >
        <div className="tw-flex tw-flex-col">
          <div className="tw-text-sm">
            {hoverData.lat.toFixed(1)}, {hoverData.lon.toFixed(1)}
          </div>

          <div>
            {selLayers.map((l, i) => {
              let monthName =
                !l.month || l.month === "all"
                  ? "All Months"
                  : new Date(`2020-${l.month}-15`).toLocaleString("default", {
                      month: "short",
                    });

              return (
                <div
                  key={`popup-${i}`}
                  className="tw-flex tw-items-center tw-text-xs tw-gap-2"
                >
                  {l.type === "distribution" ? (
                    <>
                      <div className="tw-w-6 tw-text-right">
                        {hoverData.layers[i].level}
                      </div>
                      <div>
                        <PaletteSwatch
                          palette={l.palette}
                          extraClasses={"tw-shadow tw-border tw-border-black"}
                          height={4}
                          width={20}
                          rounded={false}
                          highlightValue={
                            (hoverData.layers[i].level - 1) / maxLevel
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div className={rangeWClass}>
                      <PaletteSwatch
                        palette={l.palette}
                        extraClasses={"tw-shadow tw-border tw-border-black"}
                        holderClasses={"tw-float-right"}
                        size={4}
                        rounded={false}
                      />
                    </div>
                  )}
                  <div className="tw-text-gray-700 tw-font-bold tw-capitalize">
                    {speciesLookup[l.aphiaId]?.commonName}
                  </div>
                  <div className="tw-text-gray-600 tw-capitalize">
                    {l.year} &middot; {monthName}{" "}
                    {l.project !== "_ALL" && (
                      <>
                        {" "}
                        &middot;{" "}
                        <span className="tw-font-bold">{l.project}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Popup>
    );
  }, [hoverData]);

  return (
    <div className="tw-relative tw-text-base">
      <div className="tw-flex">
        <GLMap
          idField="key"
          mapStyle={BaseStyles[basemapStyle]}
          mapHeight={700}
          mapWidth={700}
          maxZoom={4}
          interactiveLayerIds={layerData.map((ld) => ld.layerKey)}
          onHover={setHoverData}
          overlayComponents={
            <div className="tw-absolute tw-bottom-0 tw-right-0 tw-mb-8 tw-mr-4">
              <Legend
                maxLevel={maxLevel}
                palettes={layerData.filter(ld => ld.type === 'distribution').map((ld) => ld.palette)}
                presents={layerData.filter(ld => ld.type === 'range').map(ld => ld.palette)}
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
                updateShownProjects={updateShownProjects}
                maxLevel={maxLevel}
                type={ld.type}
              />
            );
          })}
          {hoverPopup}
        </GLMap>
        <div className="tw-relative">
          <div
            className="tileholder tw-flex tw-flex-col tw-absolute"
            style={{ left: "-16em" }}
          >
            {!readOnly &&
              layerData.map((ld, idx) => {
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
                    onLayerDuplicate={() => addLayer(idx, true)}
                    enableDuplicate={layerData.length < 5}
                  />
                );
              })}
          </div>
          <div>
            {!readOnly && (
              <LayerEditor
                notifyUpdate={onLayerUpdate}
                currentLayer={layerData[activeIdx]}
                dataInventory={dataInventory}
                citations={citations}
                onShowCitations={(codes) => setShowCitations(codes)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="tw-bg-gray-300 tw-border-b tw-border-gray-600 tw-text-sm tw-py-2 tw-px-2 tw-relative">
        <div className="tw-flex">
          <img
            className="tw-w-16 tw-absolute tw-bottom-0 tw-mb-2 tw-border tw-border-gray-300 tw-rounded-md tw-shadow tw-cursor-pointer"
            src="https://secoora.org/wp-content/uploads/2017/06/fact_logo.jpg"
            alt="FACT Logo"
            onClick={() => setReadOnly(!readOnly)}
          />
          <div className="tw-ml-16 tw-mr-4">
            <span className="tw-ml-2 tw-font-bold">FACT DaViT</span> &middot;{" "}
            <a href="https://secoora.org/fact/" target="_blank">
              https://secoora.org/fact/
            </a>
          </div>
          {shownProjectCodes.length > 0 && (
            <div
              className="tw-inline tw-cursor-pointer"
              onClick={() => setShowCitations(shownProjectCodes)}
            >
              <div className="tw-inline tw-font-bold">Data Shown: </div>
              {shownProjectCodes.map((pc, i) => {
                return (
                  <span key={i}>
                    {!!i && ", "}
                    {pc}
                  </span>
                );
              })}
            </div>
          )}
          &nbsp;
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

