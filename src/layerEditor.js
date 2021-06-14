import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";

import Chooser from "./chooser.js";
import Palettes from "./palettes.js";

const LayerEditor = (props) => {

  const _updateLayer = (value) => {
    // const newLayerData = layerData.map((ld, idx) => {
    //   if (idx != activeIdx) {
    //     return ld;
    //   }
    //   return {
    //     ...ld,
    //     ...value
    //   }
    // });

    // setLayerData(curLd => newLayerData);
    const updatedLayer = {
      ...props.currentLayer,
      ...value
    };

    props.notifyUpdate(updatedLayer);
  }

	return (
    <div className="w-64 bg-gray-400 p-2 h-full">
      <Chooser
        items={props.allAphiaIds}
        labels={props.allSpeciesNames}
        onClick={(v) => _updateLayer({ aphiaId: v, project: "_ALL" })} // always reset project when changing species
        curVal={props.currentLayer.aphiaId}
        label="Species"
      />

      <Chooser
        items={["_ALL", ...props.speciesProjects]}
        onClick={(v) => _updateLayer({ project: v })}
        curVal={props.currentLayer.project}
        label="Project"
      />

      <Chooser
        items={[
          2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
          2020,
        ]}
        enabledItems={props.availYears}
        onClick={(v) => _updateLayer({ year: v })}
        curVal={props.currentLayer.year}
        label="Year"
      />

      <Chooser
        items={[...Array(12).keys(), "all"].map((m) =>
          m !== "all" ? m + 1 : m
        )}
        enabledItems={[...props.availMonths, "all"]}
        onClick={(v) => _updateLayer({ month: v })}
        curVal={props.currentLayer.month}
        label="Month"
      />

      <hr />

      <Chooser
        items={Object.keys(Palettes)}
        onClick={(v) => _updateLayer({ palette: v })}
        curVal={props.currentLayer.palette}
        label="Palette"
      />

      <div>
        <label htmlFor="opacity" className="block text-sm">
          Opacity
        </label>
        <div className="inline-block relative w-64">
          <input
            type="range"
            id="opacity"
            name="opacity"
            min="0"
            max="100"
            value={props.currentLayer.opacity || 50}
            onChange={(e) =>
              _updateLayer({ opacity: parseInt(e.target.value) })
            }
          />
        </div>
      </div>
    </div>
  );
}

export default LayerEditor;