import React, { useState, useMemo, useEffect } from "react";
import ReactDOM from "react-dom";

const CitationModal = (props) => {
	return (
    <div className="h-full w-full absolute flex items-center justify-center bg-gray-500 bg-opacity-50 top-0 left-0">
      <div className="bg-white rounded shadow p-8 m-4 max-w-md max-h-full overflow-y-scroll">
        <div className="text-sm mb-1">Citations</div>

        {props.showCitations.map((sp) => {
          return (
            <div key={`cite-${sp}`} className="text-sm mb-1">
              <div className="font-bold">
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
        <div className="flex justify-center">
          <button
            onClick={props.onClose}
            className="flex-no-shrink text-white py-2 px-4 rounded bg-indigo-500 hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CitationModal;