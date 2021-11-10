import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";

const CitationModal = (props) => {
	return (
    <div className="tw-h-full tw-w-full tw-absolute tw-flex tw-items-center tw-justify-center tw-bg-gray-500 tw-bg-opacity-50 tw-top-0 tw-left-0">
      <div className="tw-bg-white tw-rounded tw-shadow tw-p-8 tw-m-4 tw-max-w-md tw-max-h-full tw-overflow-y-scroll">
        <div className="tw-text-sm tw-mb-1">Citations</div>

        {props.showCitations.map((sp) => {
          return (
            <div key={`cite-${sp}`} className="tw-text-sm tw-mb-1">
              <div className="tw-font-bold">
                {props.citations[sp]?.shortname}
              </div>
              <div className="">{props.citations[sp]?.citation}</div>
              {props.citations[sp]?.website && (
                <a href={props.citations[sp]?.website} target="_blank">
                  {props.citations[sp]?.website}
                </a>
              )}
            </div>
          );
        })}
        <div className="tw-flex tw-justify-center">
          <button
            onClick={props.onClose}
            className="tw-flex-no-shrink tw-text-white tw-py-2 tw-px-4 tw-rounded tw-bg-indigo-500 hover:tw-bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CitationModal;