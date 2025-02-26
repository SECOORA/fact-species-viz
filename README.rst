

FACT DaViT
===============================

This project is a data visualization tool for the Florida Atlantic Coast Telemetry (FACT) network.
It includes both backend and frontend components for fetching, processing, and visualizing species data.

The FACT DaViT (Data Visualization Tool) displays animal movement metrics.
Using acoustic telemetry data from the FACT Network (southeastern US, with global collaboration through OTN),
this tool shows range and distribution on a map for a number of studied species
within the FACT Network's members.

A live deployment: https://secoora.org/fact/data-visualization-tool/

Copyright 2025 Axiom Data Science, LLC

See LICENSE for details.


What is acoustic telemetry?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Acoustic telemetry uses sound to transmit information underwater.
An animal is tagged with an acoustic transmitter which emits a sounds that
is understood and decoded by a receiver which is submerged underwater in a fixed location.
The receiver logs the unique ID, date, and time of when the animal was within
the listening range of the receiver. See https://secoora.org/fact/acoustic-telemetry/
for more information.

Project structure
-----------------

Unforunately, the frontend and backend projects are overlaid on top of each other
in the root of the repository. This means that there are Python and Node.js configuration
files mixed together. The Python source code for the backend is in the ``scripts``
directory, and the frontend JavaScript source code is in the ``src`` directory with HTML in ``static``.

Python project installation
---------------------------

The backend Python project relies on conda for installation and managing of the project dependencies.

1. Download and install miniconda for your operating system https://docs.conda.io/en/latest/miniconda.html.

2. Clone this project with ``git``.

3. Once conda is available build the environment for this project with::

      conda env create -f environment.yml

   The above command creates a new conda environment titled ``fact-species-viz`` with the necessary project
   dependencies.

4. An Additional environment file is present for testing and development environments. The additional developer dependencies can be installed with::

      conda env update -f dev-environment.yml

5. To install the project to the new environment::

      conda activate fact-species-viz
      pip install -e .

There is also a ``modd.conf`` file for development  with `modd <https://github.com/cortesi/modd>`_.

Running Tests
-------------

To run the Python project's tests::

      make test

or run pytest directly::

      pytest

To run Python project linting and formatting checks::

      make lint # only check
      make format # fixes formatting and checks with flake8
      pre-commit run --all-files # runs a comprehensive analysis

Building with Docker
--------------------

To build the docker containers::

      docker build -t davit-api . --file Dockerfile.backend
      docker build -t davit-ui .

Running with Docker
-------------------
To start the backend stack using the docker compose file::

      docker compose up -d

To start the frontend server::

      docker run \
            -p 47001:80 \
            -e DATA_URL=http://localhost:47000 \
            -e MAPBOX_TOKEN=your-mapbox-token \
            davit-ui

Now you should be able to see the API documentation at http://localhost:47000/docs
and Flower task monitoring at http://localhost:45555.

The fontend application should be available at http://localhost:47001.

About and History
-----------------

Dave Foster built both the backend service and front end application during 2021/2022
at Axiom Data Sciene.

Later this project was made open source and published here on GitHub.

Backend
^^^^^^^

The ``fact-species-viz`` project started as a command line processing tool to take “raw” detection
extracts data from acoustic telemetry research and transform them into geojson products
representing range and distribution of species. These geojson files can be shown on a map.

The backend has since evolved into a small API that can perform the required processing
for any approved unit of data via a Celery queue and workers.
While the end product is geojson files and is intended to possibly not need a service
(just serve the geojson files, along with some sort of inventory file cataloging the contents
of the geojson files), there is a service that stores both the geojson files as well as
inventory and metadata in a private Redis instance.

The backend is written in Python and uses FastAPI/uvicorn for async API access,
Celery for queuing of jobs, and geopandas for data processing/manipulation.

Frontend
^^^^^^^^

The frontend portion started as a React application with ``react-map-gl`` (``mapbox-gl`` based)
at its core to display the computed geojson files.

The frontend application allows users to see the available species and research projects
contributing to the species products along with comparison tools via layering
(z-index w/ opacity) and hover interrogation.

The application is designed to direct you toward contacting specific researchers by
including citations and metadata about the data shown.

The frontend is able to save current user state via the browser's localStorage feature,
allowing resuming of a session by the same browser.

Data
^^^^

The FACT DaViT frontend and backend produce no unique data.
The geojson files and metadata are produced via computation by the backend service
and can be recomputed at any time from source data. The source data is pulled via API access
to the `Research Workspace <https://researchworkspace.com/intro/>`_ over several projects.
This source data is called “Detection Extracts”
and consist of zipped CSV files which are generated by the FACT Network and OTN three times
a year (known as a “data push” - when researchers send their raw data in, this raw data is
cleaned and aligned with other researchers data for a more complete picture).

When requested, the backend service will enqueue and execute processing of data by project.
Projects available in the DaViT are opt-in, meaning folks involved in the research must approve
their projects to be added. This is managed by FACT with the help of a form
at https://secoora.org/fact/davit-agreement/ | http://git.axiom/axiom/fact-agreement.
Joy Young (FACT leader) keeps a list of approved projects.
A single endpoint can be POSTed to in order to regenerate all data.

While the source data is stored by project, the geojson products are primarily by species.
Many projects that research the same species contribute to the geojson products.
This contribution happens automatically in the backend when more than one project
has the same species, no matter when it's been processed.

Data processing has two rounds: first by project code, then the “ALL” layer.
The “ALL” layer must be done separately because it has to happen after all project codes
have been finished.

Credits
-------

This package was updated with Cookiecutter_ and the `audreyr/cookiecutter-pypackage`_ project template.

.. _Cookiecutter: https://github.com/audreyr/cookiecutter
.. _`audreyr/cookiecutter-pypackage`: https://github.com/audreyr/cookiecutter-pypackage
