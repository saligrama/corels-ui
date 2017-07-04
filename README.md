# CORELS UI
Web user interface for nlarusstone/corels using NodeJS and Python 3. Requires NodeJS modules `formidable` and `python-shell`.

# Installation
You must have NodeJS and Python 3 installed. Then, in the terminal run `npm install formidable python-shell`.

`cd` into the `ui` directory and run `node corels.js` (may be `nodejs corels.js` depending on your operating system). The server will be running at `http://localhost:8080`.

# Usage
Simply upload a zip file containing a `.label` file, a `.out` file, and optionally a `.minor` file. The optimal rule list will be found and displayed.
