import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import _ from 'lodash';

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

  const aphiaIds = useMemo(() => {
    return props.dataInventory.map(di => di.aphiaId)
  }, [props.dataInventory]);

  const speciesNames = useMemo(() => {
    return props.dataInventory.map(di => di.speciesCommonName)
  }, [props.dataInventory]);

  const speciesProjects = useMemo(() => {
    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === props.currentLayer.aphiaId);
    if (!invItem) {
      return [];
    }

    // move _ALL to the front
    return [
      '_ALL',
      ...Object.keys(invItem.byProject).filter(k => k !== '_ALL')
    ]
  }, [props.dataInventory, props.currentLayer.aphiaId]);

  const availYears = useMemo(() => {
    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === props.currentLayer.aphiaId);
    if (!invItem) {
      return [];
    }

    // @TODO technically should filter by project too
    return invItem.byProject['_ALL'].years.map(yd => yd.year);

  }, [props.dataInventory, props.currentLayer.aphiaId]);

  const availMonths = useMemo(() => {

    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === props.currentLayer.aphiaId);
    if (!invItem) {
      return [];
    }

    // @TODO technically should filter by project too
    const yearData = _.find(invItem.byProject['_ALL'].years, (v) => v.year === props.currentLayer.year);
    return yearData?.months;
  }, [props.dataInventory, props.currentLayer.aphiaId, props.currentLayer.year]);

	return (
    <div className="w-64 bg-gray-400 p-2 h-full">
      <Chooser
        items={aphiaIds}
        labels={speciesNames}
        onClick={(v) => _updateLayer({ aphiaId: v, project: "_ALL" })} // always reset project when changing species
        curVal={props.currentLayer.aphiaId}
        label="Species"
      />

      <Chooser
        items={speciesProjects}
        labels={['All Projects', ...speciesProjects.slice(1)]}
        onClick={(v) => _updateLayer({ project: v })}
        curVal={props.currentLayer.project}
        label="Project"
      />

      <Chooser
        items={[
          2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
          2020,
        ]}
        enabledItems={availYears}
        onClick={(v) => _updateLayer({ year: v })}
        curVal={props.currentLayer.year}
        label="Year"
      />

      <Chooser
        items={[...Array(12).keys(), "all"].map((m) =>
          m !== "all" ? m + 1 : m
        )}
        enabledItems={[...availMonths, "all"]}
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