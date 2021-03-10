import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

import MapGrid from "./mapgrid.js"
import Chooser from "./chooser.js";

const trackercodes = [
  'BLKTP',
  'FLKEYST',
  'FSUGG'
]

function SpeciesVizApp(props) {

  const [trackerCode, setTrackerCode] = useState('BLKTP');
  const [month, setMonth] = useState(5);
  const [year, setYear] = useState(2018);

  return <div>

    <h1 className="h1">FACT RANGE TESTBED</h1>
    <Chooser
      items={trackercodes}
      onClick={v => setTrackerCode(v)}
      curVal={trackerCode}
      label="Project"
    />

    <Chooser
      items={[2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020]}
      onClick={v => setYear(v)}
      curVal={year}
      label="Year"
    />

    <Chooser
      items={[...Array(12).keys()].map(m => m+1)}
      onClick={v => {
        console.info("WE changing month", v)
        setMonth(v)
      }}
      curVal={month}
      label="Month"
    />

    <MapGrid 
      trackercode={trackerCode}
      years={[year]}
      months={[month]}
      variants={['FULL', 'FULL_concave', 'FULL_convex', 'FULL_rbbox', 'ANIM_BOXES']}
    /> 
  </div>
}

export default SpeciesVizApp;

