# CORELS UI
Web user interface for nlarusstone/corels using NodeJS and Python 3. Requires NodeJS module `formidable`.

# Installation
Clone the repository.

    git clone https://github.com/saligrama/corels-ui

Compile the CORELS code.

    cd corels/src
    make
    cd ../..

You must have NodeJS and Python 3 installed. Then, install required NodeJS libraries:

    npm install formidable

# Usage

Run the server which is accessible from `http://localhost:8080`.

    cd ui
    node corels.js

Simply upload a zip file containing a `.label` file, a `.out` file, and optionally a `.minor` file. The optimal rule list will be found and displayed.
