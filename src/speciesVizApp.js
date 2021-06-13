import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {useLocation, useHistory} from 'react-router';
import axios from "axios";
import _ from 'lodash';

import DistMap from "./distMap.js"
import Chooser from "./chooser.js";
import Palettes from "./palettes.js";

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
}

function SpeciesVizApp(props) {

  let query = useQuery(),
    location = useLocation(),
    history = useHistory();

  const [allAphiaIds, setAllAphiaIds] = useState([]);
  const [allSpeciesNames, setAllSpeciesNames] = useState([]);
  const [aphiaId, setAphiaId] = useState(parseInt(query.get('aphiaId')) || 105793)
  const [speciesProjects, setSpeciesProjects] = useState([]);
  const [project, setProject] = useState("_ALL");
  const [month, setMonth] = useState(query.get('month') || 'all');
  const [year, setYear] = useState(query.get('year') || 2019);
  const [availYears, setAvailYears] = useState([]);
  const [availMonths, setAvailMonths] = useState([]);
  const [palette, setPalette] = useState('thermal');
  const [beforeId, setBeforeId] = useState('z-0');

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

  // handle any url params controlling state
  useEffect(() => {
    if (query.has("aphiaId")) {
      const aphiaId = parseInt(query.get("aphiaId"));
      setAphiaId(aphiaId);
    }

    if (query.has("month")) {
      let m = query.get("month");
      if (m !== "all") {
        m = parseInt(m);
      }
      setMonth(m);
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

  const _setAphiaId = (newAphiaId) => {
    history.push(
      {
        pathname: location.pathname,
        search: buildQueryString({newAphiaId: newAphiaId})
      }
    )

    setAphiaId(newAphiaId);

    // other state changes:
    setProject('_ALL');
    setSpeciesProjects([]);
  }

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
    async function getProjects() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/projects/${aphiaId}`);
      setSpeciesProjects(response.data)
    }

    getProjects();
  }, [aphiaId])

  useEffect(() => {
    async function getYears() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/species/${aphiaId}/years`);
      setAvailYears(response.data)
    }

    getYears();
  }, [aphiaId])

  useEffect(() => {
    async function getMonths() {
      const response = await axios.get(`${process.env.DATA_URL}/atp/species/${aphiaId}/${year}`);
      setAvailMonths(response.data)
    }

    getMonths();
  }, [aphiaId, year])

  return (
    <div className="mr-12">
      <nav>
        <h1 className="text-2xl ml-24 mb-2 pl-1">
          <a href="/">FACT DaViT</a>
        </h1>
        <Chooser
          items={allAphiaIds}
          labels={allSpeciesNames}
          onClick={_setAphiaId}
          curVal={aphiaId}
          label="Species"
        />

        <Chooser
          items={["_ALL", ...speciesProjects]}
          onClick={setProject}
          curVal={project}
          label="Project"
        />

        <Chooser
          items={[
            2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
            2020,
          ]}
          enabledItems={availYears}
          onClick={_setYear}
          curVal={year}
          label="Year"
        />

        <Chooser
          items={[...Array(12).keys(), "all"].map((m) =>
            m !== "all" ? m + 1 : m
          )}
          enabledItems={[...availMonths, "all"]}
          onClick={_setMonth}
          curVal={month}
          label="Month"
        />

        <Chooser
          items={Object.keys(Palettes)}
          onClick={setPalette}
          curVal={palette}
          label="Palette"
        />

        <Chooser
          items={['z-0', 'z-1', 'z-2', 'z-3', 'z-4']}
          onClick={setBeforeId}
          curVal={beforeId}
          label="beforeID"
        />
      </nav>

      <DistMap
        aphiaId={aphiaId}
        project={project}
        year={year}
        month={month}
        mapHeight={700}
        palette={palette}
        beforeId={beforeId}
      />
    </div>
  );
}

export default SpeciesVizApp;

