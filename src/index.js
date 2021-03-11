import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";

import SpeciesVizApp from "./speciesVizApp.js"

var mountNode = document.getElementById("app");
ReactDOM.render(
  <Router>
    <Switch>
      <Route path='/'>
        <SpeciesVizApp />
      </Route>
    </Switch>
  </Router>,
  mountNode
);
// ReactDOM.render(<GLMap 
//   idField="key"
// />, mountNode);