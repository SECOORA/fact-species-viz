import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import _ from 'lodash';

import Chooser from "./chooser.js";
import Palettes from "./palettes.js";
import {IconLeft, IconRight, IconZoom} from "./icon.js";
import classNames from "classnames";

const LayerEditor = (props) => {

  const _updateLayer = (value) => {
    let updatedLayer = {
      ...props.currentLayer,
      ...value
    };

    // auto-adjust both year and month to a closest available one
    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === updatedLayer.aphiaId),
      yearData = invItem.byProject[updatedLayer.project]?.years;

    if (!yearData) {
      console.warn("updateLayer could not find project", updatedLayer, "for", updatedLayer.aphiaId);
      return;
    }

    let newYear = updatedLayer.year;
    const availYears = yearData.map(yd => yd.year),
      okYear = availYears.indexOf(newYear) !== -1;

    if (!okYear) {
      // if the year doesn't exist, we'll need to change the year (and likely the month)

      // get the closest years by taking difference from expected year, we might have two 1s if say a gap exists
      // ie we're currently on 2016 and (2015 yes, 2016 no, 2017 yes) is the situation, and that's ok, we just need any valid year
      const closestYears = _.sortBy(availYears, y => Math.abs(y - newYear));
      newYear = closestYears[0];

    }

    // now, adjust month if necessary.
    let newMonth = updatedLayer.month;
    if (newMonth !== 'all') {
      const newYearData = _.find(yearData, (yd) => yd.year === newYear),
        okMonth = newYearData.months.indexOf(newMonth) !== -1;

      if (!okMonth) {
        const closestMonths = _.sortBy(newYearData.months, m => Math.abs(m - newMonth));
        newMonth = closestMonths[0];
      }

      // update the layer with new year/month (might be the same)
      updatedLayer = {
        ...updatedLayer,
        year: newYear,
        month: newMonth
      }
    }

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

    // should filter by project too
    return invItem.byProject[props.currentLayer.project].years.map(yd => yd.year);

  }, [props.dataInventory, props.currentLayer.aphiaId, props.currentLayer.project]);

  const availMonths = useMemo(() => {

    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === props.currentLayer.aphiaId);
    if (!invItem) {
      return [];
    }

    // should filter by project too
    const yearData = _.find(invItem.byProject[props.currentLayer.project].years, (v) => v.year === props.currentLayer.year);
    return yearData?.months;
  }, [props.dataInventory, props.currentLayer.aphiaId, props.currentLayer.year, props.currentLayer.project]);

  const changeYear = (direction = 1) => {
    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === props.currentLayer.aphiaId),
      projectData = invItem.byProject[props.currentLayer.project],
      availYears = projectData.years.map(yd => yd.year),
      curIdx = availYears.indexOf(props.currentLayer.year);

    if (curIdx === 0 && direction === -1) {
      return;
    }
    if (curIdx === availYears.length - 1 && direction === 1) {
      return;
    }

    const newYear = availYears[curIdx + direction];

    _updateLayer({
      year: newYear
    })
  }

  const changeMonth = (direction = 1) => {
    if (props.currentLayer.month === 'all') {
      return;
    }

    const invItem = _.find(props.dataInventory, (v) => v.aphiaId === props.currentLayer.aphiaId),
      projectData = invItem.byProject[props.currentLayer.project],
      availYears = projectData.years.map(yd => yd.year),
      curYear = _.find(projectData.years, (v) => v.year === props.currentLayer.year),
      availMonths = curYear.months,
      curIdx = availMonths.indexOf(props.currentLayer.month);

    if (curIdx === 0 && direction === -1) {
      // @TODO: wrap
      return;
    }
    if (curIdx === availMonths.length - 1 && direction === 1) {
      // @TODO: wrap
      return;
    }

    const newMonth = availMonths[curIdx + direction];
    _updateLayer({
      month: newMonth
    });
  }

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
        labels={["All Projects", ...speciesProjects.slice(1)]}
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
        before={<IconLeft size={4} onClick={() => changeYear(-1)} />}
        after={<IconRight size={4} onClick={() => changeYear(1)} />}
      />

      <Chooser
        items={[...Array(12).keys(), "all"].map((m) =>
          m !== "all" ? m + 1 : m
        )}
        enabledItems={[...(availMonths || []), "all"]}
        onClick={(v) => _updateLayer({ month: v })}
        curVal={props.currentLayer.month}
        label="Month"
        before={
          <IconLeft size={4} onClick={() => changeMonth(-1)} extraClasses="" />
        }
        after={<IconRight size={4} onClick={() => changeMonth(1)} />}
      />

      <div className="flex mx-2 my-4">
        <button
          className={classNames("text-sm flex-grow rounded-r-none border-l-0  hover:scale-110 focus:outline-none flex justify-center px-4 py-2 rounded font-bold cursor-pointer",
          {
            "hover:bg-indigo-200 bg-indigo-100 text-indigo-700 border duration-200 ease-in-out border-indigo-600 transition": props.currentLayer.type === 'distribution',
            "hover:bg-gray-200 bg-gray-100 text-gray-700 border duration-200 ease-in-out border-gray-600 transition": props.currentLayer.type !== 'distribution'
          })}
          onClick={() => _updateLayer({type: 'distribution'})}
        >
          <div className="flex leading-5">Distribution</div>
        </button>
        <button
          className={classNames("text-sm flex-grow rounded-l-none border-l-0  hover:scale-110 focus:outline-none flex justify-center px-4 py-2 rounded font-bold cursor-pointer",
          {
            "hover:bg-indigo-200 bg-indigo-100 text-indigo-700 border duration-200 ease-in-out border-indigo-600 transition": props.currentLayer.type === 'range',
            "hover:bg-gray-200 bg-gray-100 text-gray-700 border duration-200 ease-in-out border-gray-600 transition": props.currentLayer.type !== 'range'
          })}
          onClick={() => _updateLayer({type: 'range'})}
        >
          <div className="flex leading-5">Range</div>
        </button>
      </div>

      <hr className="my-2" />

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

      <hr className="my-2" />

      <div>
        <div className="text-sm mb-1 flex">
          Citations
          <IconZoom
            onClick={() => props.onShowCitations(speciesProjects.slice(1))}
            size={4}
            extraClasses="flex-shrink"
          />
        </div>

        {speciesProjects.slice(1).map(sp => {
          return (
            <div key={`cite-${sp}`} className="text-xs mb-1">
              <div className="font-bold truncate">{props.citations[sp]?.shortname}</div>
              <div className="truncate">{props.citations[sp]?.citation}</div>
              {props.citations[sp]?.website && (
                <a href={props.citations[sp]?.website} target="_blank">
                  {props.citations[sp]?.website}
                </a>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}

export default LayerEditor;