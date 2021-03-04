import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

import MapGrid from "./mapgrid.js"

const trackercodes = [
  'BLKTP',
  'FLKEYST',
  'FSUGG'
]

function SpeciesVizApp(props) {

  const [trackerCode, setTrackerCode] = useState('BLKTP');
  const [month, setMonth] = useState(5);

  const selectTracker = (tc) => {
    setTrackerCode(tc);
  }

  return <div>

    <h1>FACT RANGE TESTBED</h1>
    <div className="link-holder">
      {trackercodes.map(tc => {
        return       <a key={tc} href="#" onClick={e => selectTracker(tc)}>{tc}</a>
      })}
    </div>

    <div className="link-holder">
      {[...Array(12).keys()].map(m => {
        return <a key={m+1} href="#" onClick={e => setMonth(m+1)}>{m+1}</a>
      })}
    </div>

    <MapGrid 
    trackercode={trackerCode}
    years={[2018]}
    months={[month]}
    variants={['FULL', 'MONTH', 'WEEK']}
  /> 
  </div>
}

export default SpeciesVizApp;

