import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import * as Sentry from "@sentry/react";
// import { Integrations } from "@sentry/tracing";

Sentry.init({
  dsn: "https://bd2f63b5e0774883ae1bbcef7ab404e0@sentry.srv.axds.co/13",
  // integrations: [new Integrations.BrowserTracing()],
  // tracesSampleRate: parseFloat(process.env.TRACES_SAMPLE_RATE) || 0.05,
  denyUrls: ["//localhost:"],
  ignoreErrors: [/^[^(ResizeObserver loop limit exceeded)]/],
});

import SpeciesVizApp from "./speciesVizApp.js"

function ErrorFallback({ error }) {
  return (
    <div
      className="tw-relative tw-h-full tw-w-full"
      style={{
        minHeight: "677px"
      }}
    >
      <div className="tw-h-full tw-w-full tw-absolute tw-flex tw-items-center tw-justify-center tw-bg-gray-500 tw-bg-opacity-50 tw-top-0 tw-left-0">
        <div
          role="alert"
          className="tw-bg-white tw-rounded tw-shadow tw-p-8 tw-m-4 tw-max-w-md tw-max-h-full tw-overflow-y-scroll tw-text-sm"
        >
          <div className="tw-mb-1">
            Something went wrong, please reload the site.
          </div>
          <details>
            <summary>
              <pre style={{ color: "red" }}>{error.message}</pre>
            </summary>
            <pre className="tw-text-xs" style={{ color: "maroon" }}>
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