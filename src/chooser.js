import React, {useState, useMemo, useEffect} from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";

function Chooser(props) {

  return (
    <div>
      <div className="text-sm">{props.label}</div>
      <div className="flex items-center">

        {props.before}

        <div className="inline-block relative w-full">
          <select
            className="block appearance-none w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
            value={props.curVal}
            onChange={(e) => {
              const tc = parseInt(e.target.value) || e.target.value;
              if (props.enabledItems && props.enabledItems.indexOf(tc) === -1) {
                return;
              }
              props.onClick(tc);
            }}
          >
            {props.items.map((tc, i) => {
              const isEnabled = !!(
                  props.enabledItems?.indexOf(tc) !== -1 ?? true
                ),
                label = props.labels ? props.labels[i] : tc;

              if (!isEnabled) {
                return null;
              }

              return (
                <option key={`${tc}-${i}`} value={tc}>
                  {label}
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg
              className="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>

        {props.after}
      </div>
    </div>
  );
};

export default Chooser;