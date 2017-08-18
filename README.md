# CORELS UI
Web user interface for nlarusstone/corels using NodeJS and Express. Now live at https://corels.eecs.harvard.edu !

Requires NodeJS libraries `express`, `multer`, `body-parser`, and `string`.

# Installation
Clone the repository.

    git clone --recursive https://github.com/saligrama/corels-ui

Compile the CORELS code.

    cd corels/src
    make
    cd ../..

You must have NodeJS installed. Then, install required NodeJS libraries:

    npm install express multer body-parser string

# Usage

Run the server which is accessible from `http://localhost:8080`.

    cd ui
    node corels.js

The command may be `nodejs corels.js` depending on your operating system (this is true of Ubuntu).
