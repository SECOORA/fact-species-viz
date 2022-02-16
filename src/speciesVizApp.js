import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import _ from 'lodash';
import classNames from "classnames";
import { Popup } from "react-map-gl";
import { Oval } from "react-loading-icons";

import GLMap from "./glmap.js";
import CitationModal from "./citationModal.js";
import DataLayer from "./dataLayer.js";
import LayerTile from "./layerTile.js";
import LayerEditor from "./layerEditor.js";
import Legend from "./legend.js";
import Palettes from "./palettes.js";
import PaletteSwatch from "./paletteSwatch.js";
import BaseStyles from "./baseStyles.js";
import {IconCog, IconZoom, IconZoomOut, IconEye, IconEyeOff, IconImage} from "./icon.js";
import SpeciesImage from "./speciesImage.js";
import { accessibilityOverscanIndicesGetter } from "react-virtualized";

const getRandomItem = (iterable) => iterable[Math.floor(Math.random() * iterable.length)]

const defaultLayerData = [
  {
    layerKey: "ooba",
    aphiaId: 105793,
    year: 2017,
    project: "_ALL",
    month: "all",
    palette: "viridis",
    type: "distribution",
  },
]; 

function SpeciesVizApp(props) {

  // load layerData from localstorage, but swallow errors
  let storedLayerData = undefined;
  try {
    storedLayerData = JSON.parse(localStorage.getItem('atp-layerData') || 'null');
  } catch (e) {}

  const [basemapStyle, setBasemapStyle] = useState(localStorage.getItem('atp-basemap-name') || 'greyscale');
  const [dataInventory, setDataInventory] = useState([]);
  const [citations, setCitations] = useState({}); // project code -> {shortname, citation, website}
  const [maxLevels, setMaxLevels] = useState({}); // layerKey -> maximum
  const [shownProjects, setShownProjects] = useState({}); // layerKey -> [project codes]
  const [speciesPhotos, setSpeciesPhotos] = useState({}); // aphiaID -> {urls/media metadata}
  const [layerData, setLayerData] = useState(storedLayerData || defaultLayerData);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showCitations, setShowCitations] = useState([]);   // list of project codes
  const [readOnly, setReadOnly] = useState(false);      // removes interactive UI
  const [hoverData, setHoverData] = useState({});       // lat, lon, layers
  const [loading, setLoading] = useState([]);           // [layerKey]
  const [miniPhotos, setMiniPhotos] = useState((localStorage.getItem('atp-mini-photos') || 'false') === 'true');  // makes species photos small/round
  const [showPhotos, setShowPhotos] = useState((localStorage.getItem('atp-show-photos') || 'true') === 'true');   // makes species photos shown or not

  const maxLevel = useMemo(() => {
    return Math.max(...Object.values(maxLevels));
  }, [maxLevels]);

  const shownProjectCodes = useMemo(() => {
    return _.uniq(_.flatMap(Object.values(shownProjects)));
  }, [shownProjects]);

  //
  // store changes in localstorage
  //
  useEffect(() => {
    localStorage.setItem('atp-basemap-name', basemapStyle)
  }, [basemapStyle]);

  useEffect(() => {
    localStorage.setItem('atp-layerData', JSON.stringify(layerData));
  }, [layerData])

  useEffect(() => {
    localStorage.setItem('atp-mini-photos', miniPhotos.toString());
  }, [miniPhotos]);

  useEffect(() => {
    localStorage.setItem('atp-show-photos', showPhotos.toString());
  }, [showPhotos]);


  //
  // get data on load
  //

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

  useEffect(() => {
    async function getPhotos() {
      const response = await axios.get(
        `${
          process.env.MEDIA_URL ||
          "https://secoora.org/wp-json/wp/v2/media?per_page=100&search=aphiaID&_fields=caption,media_details"
        }`
      );

      const raphiaId = /aphiaID:\s?(\d+)/
      const photos = Object.fromEntries(response.data.map(e => {
        const aphiaID = e.caption.rendered.match(raphiaId)[1];

        return [aphiaID, e.media_details];
      }));

      setSpeciesPhotos(photos);
    }
    getPhotos();
  }, []);

  // validate any stored layers - if inventory changes (ie projects removed) this can affect the whole app
  // wait until data inventory loads
  useEffect(() => {
    if (!storedLayerData || dataInventory.length === 0) {
      return;
    }
    const validLayers = storedLayerData.filter(ld => {
      const species = _.find(dataInventory, {aphiaId: ld.aphiaId});
      if (!species) { return false; }

      const project = species.byProject[ld.project];
      if (!project) { return false; }

      const year = _.find(project.years, {year: ld.year});
      if (!year) { return false; }

      if (!(ld.month === 'all' || year.months.indexOf(ld.month) !== -1)) { return false; }

      // don't bother checking palette/type
      return true;
    });

    console.info("Valid layer check", storedLayerData.length, "->", validLayers.length);
    console.debug(storedLayerData, validLayers);

    if (validLayers.length === 0) {
      // create layer based on first available thing in data inventory
      const [projectCode, projectData] = _.first(_.entries(dataInventory[0].byProject));

      setLayerData([
        {
          layerKey: "defo",
          aphiaId: dataInventory[0].aphiaId,
          year: projectData.years[0].year,
          project: projectCode,
          month: "all",
          palette: "viridis",
          type: "distribution",
        },
      ]);
    } else {
      setLayerData(validLayers);
    }


  }, [dataInventory]);

  const visiblePhotos = useMemo(() => {
    const aphiaIds = new Set(layerData.map(ld => ld.aphiaId)),
      hovered = Object.keys(hoverData).length === 0 ? new Set() : new Set(hoverData.layers.map(ld => ld.species_aphia_id)),
      anyHovered = hovered.size > 0,
      sp = Array.from(aphiaIds).map(aphiaId => {
        return {
          media: speciesPhotos[aphiaId],
          highlight: hovered.has(aphiaId),
          dehilight: anyHovered && !hovered.has(aphiaId)
        }
      });

    return sp.filter(s => s.media !== undefined);
  }, [speciesPhotos, layerData, hoverData]);

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

  const updateShownProjects = (projectCodes, layerKey, remove = false) => {
    setShownProjects(curShownProjects => {
      if (remove) {
        return _.omit(curShownProjects, layerKey);
      } else {
        return {
          ...curShownProjects,
          [layerKey]: projectCodes,
        };
      }
    })
  }

  const updateLoading = (layerKey, isLoading) => {
    setLoading(curLoading => {
      const lSet = new Set(curLoading);
      if (isLoading) {
        lSet.add(layerKey);
      } else {
        lSet.delete(layerKey);
      }
      return Array.from(lSet);
    })
  }

  // if we change loading layers mid load (aka last stored layers were invalid and we picked a default),
  // need to remove the loading state for the old layers
  useEffect(() => {
    if (!loading || loading.length === 0) {
      return;
    }

    const curLayerKeys = layerData.map(ld => ld.key);
    setLoading(curLoading => {
      const lSet = new Set(curLoading),
        combined = new Set([...curLayerKeys].filter(x => lSet.has(x)));

      return Array.from(combined);
    })
  }, [layerData, loading])

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
      hasDists = selLayers.filter(ld => ld.type === 'distribution').length > 0;

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

          <div className="tw-grid tw-gap-2 tw-text-xs tw-items-center" style={{'gridTemplateColumns': 'min-content min-content max-content max-content'}}>
            {selLayers.map((l, i) => {
              let monthName =
                !l.month || l.month === "all"
                  ? "All Months"
                  : new Date(`2020-${l.month}-15`).toLocaleString("default", {
                      month: "short",
                    });

              return (
                <React.Fragment key={`popup-${i}`}>
                  {l.type === "distribution" ? (
                    <>
                      <div className="tw-text-right tw-font-mono tw-w-14 tw-overflow-hidden">
                        {hoverData.layers[i].level % 1 !== 0
                          ? hoverData.layers[i].level.toFixed(2)
                          : hoverData.layers[i].level}
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
                    <>
                      <div>Present</div>
                      <div className="tw-justify-self-end">
                        <PaletteSwatch
                          palette={l.palette}
                          extraClasses={"tw-shadow tw-border tw-border-black"}
                          size={4}
                          rounded={false}
                        />
                      </div>
                    </>
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
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </Popup>
    );
  }, [hoverData]);

  const onMapClick = (clickData) => {
    if (!clickData.layers) {
      return;
    }
    const selLayerKeys = Array.from(new Set(clickData.layers.flatMap(l => l.project_codes.split(",").map(pc => pc.trim()))));
    setShowCitations(selLayerKeys);
  }

  return (
    <div className="tw-relative tw-text-base">
      <div className="tw-flex">
        <GLMap
          idField="key"
          mapStyle={BaseStyles[basemapStyle].style}
          mapHeight={670}
          mapWidth={700}
          maxZoom={4}
          interactiveLayerIds={Object.keys(shownProjects)}
          onHover={setHoverData}
          onClick={onMapClick}
          overlayComponents={
            <>
              {visiblePhotos && visiblePhotos.length > 0 && (
                <div
                  className="tw-py-1 tw-flex tw-flex-row tw-pointer-events-auto tw-max-w-max tw-select-none"
                  style={{ maxHeight: "90%" }}
                >
                  <div
                    className={classNames(
                      "tw-flex tw-flex-col tw-items-start",
                      {
                        "tw-space-y-2": showPhotos,
                      }
                    )}
                  >
                    <div
                      className={classNames(
                        "tw-flex tw-flex-row tw-bg-gray-300 tw-border-gray-600 tw-border tw-p-1 tw-rounded-sm",
                        { "tw-invisible": readOnly }
                      )}
                    >
                      <IconImage
                        size={4}
                        paddingx={0}
                        extraClasses="tw-text-gray-500"
                      />
                      <span className="tw-text-xs tw-uppercase tw-text-gray-500 tw-mr-4">
                        Photos
                      </span>
                      {showPhotos ? (
                        <IconEyeOff
                          extraClasses=""
                          size={4}
                          paddingx={1}
                          onClick={(e) => setShowPhotos(!showPhotos)}
                          tooltip="Hide Photos"
                        />
                      ) : (
                        <IconEye
                          extraClasses=""
                          size={4}
                          paddingx={1}
                          onClick={(e) => setShowPhotos(!showPhotos)}
                          tooltip="Show Photos"
                        />
                      )}
                      {miniPhotos ? (
                        <IconZoom
                          extraClasses="tw-flex-initial tw-align-center"
                          size={4}
                          paddingx={1}
                          tooltip="Expand Photos"
                          enabled={showPhotos}
                          onClick={(e) => setMiniPhotos(!miniPhotos)}
                        />
                      ) : (
                        <IconZoomOut
                          extraClasses="tw-flex-initial tw-align-center"
                          size={4}
                          paddingx={1}
                          enabled={showPhotos}
                          onClick={(e) => setMiniPhotos(!miniPhotos)}
                          tooltip="Shrink Photos"
                        />
                      )}
                    </div>

                    {visiblePhotos.map((pd, idx) => {
                      return (
                        <SpeciesImage
                          key={`species-img-${idx}`}
                          {...pd}
                          mini={miniPhotos}
                          srcSize={"medium"}
                          extraClasses={classNames({
                            "tw--ml-96 tw-max-h-0": !showPhotos,
                            "tw-ml-0 tw-max-h-full": showPhotos,
                          })}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className={classNames(
                  "tw-text-indigo-700 tw-inset-1/2 tw-absolute tw--ml-16 tw--mt-16",
                  { "tw-hidden": !loading || loading.length === 0 }
                )}
              >
                <Oval
                  height={"10em"}
                  width={"10em"}
                  stroke="currentColor"
                  strokeWidth={5}
                />
              </div>
              <div className="tw-absolute tw-bottom-0 tw-right-0 tw-mb-8 tw-mr-4">
                <Legend
                  maxLevel={maxLevel}
                  palettes={layerData
                    .filter((ld) => ld.type === "distribution")
                    .map((ld) => ld.palette)}
                  presents={layerData
                    .filter((ld) => ld.type === "range")
                    .map((ld) => ld.palette)}
                />
              </div>
            </>
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
                updateLoading={updateLoading}
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
          <div className="tw-h-full">
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
        <div className="tw-flex tw-items-center">
          <img
            className="tw-w-16 tw-absolute tw-bottom-0 tw-mb-2 tw-border tw-border-gray-300 tw-rounded-md tw-shadow tw-cursor-pointer"
            src="https://secoora.org/wp-content/uploads/2017/06/fact_logo.jpg"
            alt="FACT Logo"
            onClick={() => setReadOnly(!readOnly)}
          />
          <div className="tw-ml-16">
            <span className="tw-ml-2 tw-font-bold">FACT DaViT</span> &middot;{" "}
            <a href="https://secoora.org/fact/" target="_blank">
              https://secoora.org/fact/
            </a>
          </div>
          {!readOnly && (
            <div className="tw-flex tw-flex-row tw-gap-2 tw-ml-6">
              {Object.keys(BaseStyles).map((bs, i) => {
                return (
                  <div
                    key={`bsswatch-${i}`}
                    onClick={(e) => setBasemapStyle(bs)}
                    className={classNames(
                      "tw-rounded-md tw-has-tooltip tw-cursor-pointer tw-w-6",
                      {
                        // "tw-ring-2 tw-ring-indigo-500": bs === basemapStyle,
                        // "tw-bg-gray-400 tw-shadow": bs === basemapStyle,
                      }
                    )}
                  >
                    <img
                      className={classNames(
                        "tw-rounded-md tw-border tw-border-gray-500",
                        {
                          "tw-ring-2 tw-ring-indigo-500": bs === basemapStyle,
                        }
                      )}
                      src={BaseStyles[bs].thumbnail}
                      alt={BaseStyles[bs].title}
                    ></img>
                    <span className="tw-tooltip tw-capitalize">
                      {BaseStyles[bs].title}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {shownProjectCodes.length > 0 && (
            <div
              className="tw-inline tw-cursor-pointer tw-ml-6"
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

