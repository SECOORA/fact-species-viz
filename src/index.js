import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import * as Sentry from "@sentry/react";
// import { Integrations } from "@sentry/tracing";

Sentry.init({
  dsn: "https://bd2f63b5e0774883ae1bbcef7ab404e0@sentry.srv.axds.co/13",
  // integrations: [new Integrations.BrowserTracing()],
  // tracesSampleRate: parseFloat(process.env.TRACES_SAMPLE_RATE) || 0.05,
});

import SpeciesVizApp from "./speciesVizApp.js"

function ErrorFallback({ error }) {
  return (
    <div className="relative h-full w-full">
      <div className="h-full w-full absolute flex items-center justify-center bg-gray-500 bg-opacity-50 top-0 left-0">
        <div
          role="alert"
          className="bg-white rounded shadow p-8 m-4 max-w-md max-h-full overflow-y-scroll text-sm"
        >
          <div className="mb-1">
            Something went wrong, please reload the site.
          </div>
          <details>
            <summary>
              <pre style={{ color: "red" }}>{error.message}</pre>
            </summary>
            <pre className="text-xs" style={{ color: "maroon" }}>
              {error.stack}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

var mountNode = document.getElementById("app");
ReactDOM.render(
  <Router>
    <Switch>
      <Route path="/">
        <Sentry.ErrorBoundary fallback={ErrorFallback}>
          <SpeciesVizApp />
        </Sentry.ErrorBoundary>
      </Route>
    </Switch>
  </Router>,
  mountNode
);
// ReactDOM.render(<GLMap 
//   idField="key"
// />, mountNode);