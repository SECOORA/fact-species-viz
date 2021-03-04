import React from "react";
import ReactDOM from "react-dom";

import SpeciesVizApp from "./speciesVizApp.js"

var mountNode = document.getElementById("app");
ReactDOM.render(
  <>
    <SpeciesVizApp />
  </>,
  mountNode
);
// ReactDOM.render(<GLMap 
//   idField="key"
// />, mountNode);