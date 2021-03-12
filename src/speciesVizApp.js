import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {useLocation, useHistory} from 'react-router';

import MapGrid from "./mapgrid.js"
import Chooser from "./chooser.js";

const trackercodes = [
  'BLKTP',
  'FLKEYST',
  'FSUGG',
  'TQCS'
]

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
}

function SpeciesVizApp(props) {

  let query = useQuery(),
    location = useLocation(),
    history = useHistory();

  const [trackerCode, setTrackerCode] = useState(query.get('project') || 'BLKTP');
  const [month, setMonth] = useState(query.get('month') || 5);
  const [year, setYear] = useState(query.get('year') || 2018);

  const buildQueryString = (newArgs) => {
    let {newMonth = month, newYear = year, newProject = trackerCode} = newArgs;

    let vals = {
      month: newMonth,
      year: newYear,
      project: newProject
    }

    let kvp = Object.entries(vals).map(kv => kv.join("=")).join("&");
    let temp = `?${kvp}`;

    return temp;
  }

  // handle any url params controlling state
  useEffect(() => {
    if (query.has("project")) {
      setTrackerCode(query.get("project"));
    }

    if (query.has("month")) {
      setMonth(parseInt(query.get("month")));
    }

    if (query.has("year")) {
      setYear(parseInt(query.get("year")));
    }
  }, [location])

  const _setYear = (newYear) => {
    history.push(
      {
        pathname: location.pathname,
        search: buildQueryString({newYear: newYear})
      }
    )

    setYear(newYear);
  }

  const _setMonth = (newMonth) => {
    history.push(
      {
        pathname: location.pathname,
        search: buildQueryString({newMonth: newMonth})
      }
    )

    setMonth(newMonth);
  }

  const _setProject = (newProject) => {
    history.push(
      {
        pathname: location.pathname,
        search: buildQueryString({newProject: newProject})
      }
    )

    setTrackerCode(newProject);
  }

  return (
    <div className="mr-12">
      <div className="absolute top-0 right-0 bg-gray-200 text-sm mr-2 p-2 border border-gray-100">
        <h5 className="font-bold uppercase text-gray-500">Notes</h5>
        <p>General data availability:</p>
        <ul>
          <li>
            <strong>BLKTP:</strong> 2009-2020
          </li>
          <li>
            <strong>FLKEYST:</strong> 2010, 2012, 2014-2019
          </li>
          <li>
            <strong>FSUGG:</strong> 2010-2019
          </li>
          <li>
            <strong>TQCS:</strong> 2009-2011
          </li>
        </ul>
      </div>
      <nav>
        <h1 className="text-2xl ml-24 mb-2 pl-1">
          <a href="/">FACT RANGE TESTBED</a>
        </h1>
        <Chooser
          items={trackercodes}
          onClick={_setProject}
          curVal={trackerCode}
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
          ]}
          onClick={_setYear}
          curVal={year}
          label="Year"
        />

        <Chooser
          items={[...Array(12).keys()].map((m) => m + 1)}
          onClick={_setMonth}
          curVal={month}
          label="Month"
        />
      </nav>
      <MapGrid
        trackercode={trackerCode}
        years={[year]}
        months={[month]}
        variants={[
          "FULL",
          "FULL_concave",
          "FULL_convex",
          "FULL_rbbox",
          "ANIM_BOXES",
        ]}
      />
    </div>
  );
}

export default SpeciesVizApp;

