# CORELS UI
Web user interface for nlarusstone/corels using NodeJS and Express. Now live at https://corels.eecs.harvard.edu !

# Screenshots

### Home Page
![Home page](https://github.com/saligrama/corels-ui/raw/master/home.png "Home page")

### Run It! Page
![Run It! page](https://github.com/saligrama/corels-ui/raw/master/run.png "Run It! page")

Requires NodeJS libraries `express`, `multer`, `body-parser`, and `string`.

# Installation
Clone the repository.

    git clone --recursive https://github.com/saligrama/corels-ui

Compile the CORELS code.

    cd corels/src
    make
    cd ../..
 
Compile the utilities

    cd utils
    make all
    cd ..

You must have NodeJS installed. Then, install required NodeJS libraries:

    npm install express randomstring socket.io-file socket.io-file-client socket.io http

# Usage

Run the server which is accessible from `http://localhost:8080`.

    cd ui
    node corels.js

The command may be `nodejs corels.js` depending on your operating system (this is true of Ubuntu).
