import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";
import _ from 'lodash';

import Chooser from "./chooser.js";
import Palettes from "./palettes.js";
import {IconLeft, IconRight, IconZoom} from "./icon.js";
import classNames from "classnames";
import PaletteSwatch from "./paletteSwatch.js";

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
    if (newYear !== 'all') {
      const availYears = yearData.map(yd => yd.year),
        okYear = availYears.indexOf(newYear) !== -1;

      if (!okYear) {
        // if the year doesn't exist, we'll need to change the year (and likely the month)

        // get the closest years by taking difference from expected year, we might have two 1s if say a gap exists
        // ie we're currently on 2016 and (2015 yes, 2016 no, 2017 yes) is the situation, and that's ok, we just need any valid year
        const closestYears = _.sortBy(availYears, y => Math.abs(y - newYear));
        newYear = closestYears[0];

      }
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
    }

    // update the layer with new year/month (might be the same)
    updatedLayer = {
      ...updatedLayer,
      year: newYear,
      month: newMonth
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

  const shownPalettes = useMemo(() => {
    return _.omitBy(Palettes, (v, k) => k.endsWith('_r'));
  }, []);

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

  const enablePrevYear = useMemo(() => {
    const idx = availYears.indexOf(props.currentLayer.year);
    return idx > 0;
  }, [availYears, props.currentLayer.year]);

  const enableNextYear = useMemo(() => {
    const idx = availYears.indexOf(props.currentLayer.year);
    return idx !== -1 && idx < availYears.length - 1;
  }, [availYears, props.currentLayer.year]);

  const enablePrevMonth = useMemo(() => {
    if (props.currentLayer.month === 'all') { return false; }
    const idx = availMonths.indexOf(props.currentLayer.month);
    return idx > 0;
  }, [availMonths, props.currentLayer.month]);

  const enableNextMonth = useMemo(() => {
    if (props.currentLayer.month === 'all') { return false; }
    const idx = availMonths.indexOf(props.currentLayer.month);
    return idx !== -1 && idx < availMonths.length - 1;
  }, [availMonths, props.currentLayer.month]);

  const invertPalette = () => {
    const curPalette = props.currentLayer.palette;
    let newPalette = curPalette;
    if (curPalette.endsWith('_r')) {
      newPalette = curPalette.substring(0, curPalette.length - 2);  // chop off '_r'
    } else {
      newPalette = curPalette + '_r';
    }

    // now check if it's a real palette
    if (newPalette in Palettes) {
      _updateLayer({palette: newPalette})
    }
  }

  const displayPaletteName = useMemo(() => {
    const curPalette = props.currentLayer.palette;
    if (curPalette.endsWith('_r')) {
      return curPalette.substring(0, curPalette.length - 2);  // chop off '_r'
    }
    return curPalette;
  }, [props.currentLayer.palette])

  const canInvertPalette = useMemo(() => {
    const curPalette = props.currentLayer.palette;
    let newPalette = curPalette;
    if (curPalette.endsWith('_r')) {
      newPalette = curPalette.substring(0, curPalette.length - 2);  // chop off '_r'
    } else {
      newPalette = curPalette + '_r';
    }
    return newPalette in Palettes;
  }, [props.currentLayer.palette])

	return (
    <div className="tw-w-64 tw-bg-gray-300 tw-p-2 tw-h-full tw-border-l tw-border-gray-600">
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
          2009,
          2010,
          2011,
          2012,
          2013,
          2014,
          2015,
          2016,
          2017,
          2018,
          2019,
          2020,
          2021,
          "all",
        ]}
        labels={[
          2009,
          2010,
          2011,
          2012,
          2013,
          2014,
          2015,
          2016,
          2017,
          2018,
          2019,
          2020,
          2021,
          "All",
        ]}
        enabledItems={[...availYears, "all"]}
        onClick={(v) => _updateLayer({ year: v })}
        curVal={props.currentLayer.year}
        label="Year"
        before={
          <IconLeft
            size={4}
            onClick={() => changeYear(-1)}
            enabled={enablePrevYear}
          />
        }
        after={
          <IconRight
            size={4}
            onClick={() => changeYear(1)}
            enabled={enableNextYear}
          />
        }
      />

      <Chooser
        items={[...Array(12).keys(), "all"].map((m) =>
          m !== "all" ? m + 1 : m
        )}
        labels={[...Array(12).keys(), "all"].map((m) =>
          m !== "all" ? m + 1 : "All"
        )}
        enabledItems={[...(availMonths || []), "all"]}
        onClick={(v) => _updateLayer({ month: v })}
        curVal={props.currentLayer.month}
        label="Month"
        before={
          <IconLeft
            size={4}
            onClick={() => changeMonth(-1)}
            extraClasses=""
            enabled={enablePrevMonth}
          />
        }
        after={
          <IconRight
            size={4}
            onClick={() => changeMonth(1)}
            enabled={enableNextMonth}
          />
        }
      />

      <div className="tw-flex tw-mx-2 tw-my-4">
        <button
          className={classNames(
            "tw-text-sm tw-flex-grow tw-rounded-r-none tw-border-r-0  hover:tw-scale-110 focus:tw-outline-none tw-flex tw-justify-center tw-px-4 tw-py-2 tw-rounded tw-font-bold tw-cursor-pointer",
            {
              "hover:tw-bg-indigo-200 tw-bg-indigo-100 tw-text-indigo-700 tw-border tw-duration-200 tw-ease-in-out tw-border-indigo-600 tw-transition":
                props.currentLayer.type === "distribution",
              "hover:tw-bg-gray-200 tw-bg-gray-100 tw-text-gray-700 tw-border tw-duration-200 tw-ease-in-out tw-border-gray-600 tw-transition":
                props.currentLayer.type !== "distribution",
            }
          )}
          onClick={() => _updateLayer({ type: "distribution" })}
        >
          <div className="tw-flex tw-leading-5">Distribution</div>
        </button>
        <button
          className={classNames(
            "tw-text-sm tw-flex-grow tw-rounded-l-none tw-border-l-0  hover:tw-scale-110 focus:tw-outline-none tw-flex tw-justify-center tw-px-4 tw-py-2 tw-rounded tw-font-bold tw-cursor-pointer",
            {
              "hover:tw-bg-indigo-200 tw-bg-indigo-100 tw-text-indigo-700 tw-border tw-duration-200 tw-ease-in-out tw-border-indigo-600 tw-transition":
                props.currentLayer.type === "range",
              "hover:tw-bg-gray-200 tw-bg-gray-100 tw-text-gray-700 tw-border tw-duration-200 tw-ease-in-out tw-border-gray-600 tw-transition":
                props.currentLayer.type !== "range",
            }
          )}
          onClick={() => _updateLayer({ type: "range" })}
        >
          <div className="tw-flex tw-leading-5">Range</div>
        </button>
      </div>

      <hr className="tw-my-2" />

      <div className="tw-mb-2">
        <div className="tw-text-sm tw-mb-1">Appearance</div>

        <div className="tw-relative">
          <div className="">
            <div className="dropdown tw-group tw-relative">
              <div className="tw-inline-block tw-p-1 tw-rounded-t group-hover:tw-bg-gray-100">
                <PaletteSwatch
                  palette={props.currentLayer.palette}
                  size={7}
                  extraClasses={classNames(
                    "tw-cursor-pointer tw-shadow tw-border-gray-700 tw-border-2"
                  )}
                />
              </div>

              <div className="tw-hidden group-hover:tw-block tw-absolute tw-w-full tw-bg-gray-100 tw-z-50 tw-p-1 tw-shadow tw-rounded-bl tw-rounded-br tw-rounded-tr">
                <div className="tw-flex tw-justify-around">
                  {Object.keys(shownPalettes).map((p) => {
                    return (
                      <div
                        key={`pal-${p}`}
                        className={classNames("tw-p-1 tw-rounded-md", {
                          "tw-bg-gray-400 tw-shadow": p === displayPaletteName,
                        })}
                      >
                        <PaletteSwatch
                          palette={p}
                          size={6}
                          // rounded={false}
                          onClick={() => _updateLayer({ palette: p })}
                          extraClasses={classNames("tw-cursor-pointer", {
                            "tw-shadow-lg tw-border-gray-700 tw-border-2":
                              p === displayPaletteName,
                            "tw-shadow tw-border tw-border-gray-400":
                              p !== displayPaletteName,
                          })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="tw-absolute tw-right-0 tw-h-full tw-top-0">
              <label
                className={classNames("tw-inline-flex tw-items-center", {
                  "tw-cursor-pointer": canInvertPalette,
                  "tw-cursor-not-allowed": !canInvertPalette,
                })}
              >
                <input
                  type="checkbox"
                  className="tw-form-checkbox tw-h-5 tw-w-5 tw-text-gray-600"
                  onChange={invertPalette}
                  disabled={!canInvertPalette}
                />
                <span
                  className={classNames("tw-mx-2", {
                    "tw-text-gray-700": canInvertPalette,
                    "tw-text-gray-400": !canInvertPalette,
                  })}
                >
                  Invert
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="opacity" className="tw-block tw-text-sm">
          Opacity
        </label>
        <div className="tw-inline-block tw-relative tw-w-full">
          <input
            className="tw-w-full"
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

      <hr className="tw-my-2" />

      <div>
        <div className="tw-text-sm tw-mb-1 tw-flex">
          Citations
          <IconZoom
            onClick={() => props.onShowCitations(speciesProjects.slice(1))}
            size={4}
            extraClasses="tw-flex-shrink"
          />
        </div>

        {speciesProjects.slice(1).map((sp) => {
          return (
            <div key={`cite-${sp}`} className="tw-text-xs tw-mb-1">
              <div className="tw-font-bold tw-truncate">
                {props.citations[sp]?.shortname}
              </div>
              <div className="tw-truncate">{props.citations[sp]?.citation}</div>
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