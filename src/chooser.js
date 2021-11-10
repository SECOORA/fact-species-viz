import React, {useState, useMemo, useEffect} from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";

function Chooser(props) {

  return (
    <div>
      <div className="tw-text-sm">{props.label}</div>
      <div className="tw-flex tw-items-center">

        {props.before}

        <div className="tw-inline-block tw-relative tw-w-full">
          <select
            className="tw-block tw-appearance-none tw-w-full tw-bg-white tw-border tw-border-gray-400 hover:tw-border-gray-500 tw-px-4 tw-py-2 tw-pr-8 tw-rounded tw-shadow tw-leading-tight focus:tw-outline-none focus:tw-shadow-outline"
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
          <div className="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-0 tw-flex tw-items-center tw-px-2 tw-text-gray-700">
            <svg
              className="tw-fill-current tw-h-4 tw-w-4"
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