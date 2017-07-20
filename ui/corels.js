// builtin libraries
var exec = require('child_process').exec;

// external libraries
var express = require('express');
var multer = require('multer');
var bodyParser = require('body-parser');
var S = require('string');

var app = express();

// create upload directory if it doesn't exist
var dir = "/tmp/corels/files/"
exec("mkdir -p " + dir, {}, function (err, stdout, stderr) {
 if (err) throw err;
});

app.use(express.static('public'));

// parse text fields
app.use(bodyParser.urlencoded({ extended: false }));

// parse files
app.use(multer({ dest : dir }).fields([{name: 'out'}, {name: 'label'}, {name: 'minor'}]));

// display form
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/form.html');
})

app.post('/fileupload', function (req, res) {

  // stringify parameters
  var args = " -r ";
  for (var arg in req.body) {
    if (arg != "submit") args += req.body[arg] + " ";
  }

  // get input file paths
  var outpath = req.files.out[0].path + " ";
  var labelpath = req.files.label[0].path + " ";
  var minorpath = "";
  if (req.files.minor) minorpath = req.files.minor[0].path;

  res.write("Optimal rule list:\n");

  // run CORELS command
  var command = "../corels/src/corels " + args + outpath + labelpath + minorpath;
  exec(command, function (err, stdout, stderr) {
    if (err) throw err;

    // capture output as string.js string for easier manipulation
    // keep only the optimal rule list
    var output = S(stdout.toString()).between("OPTIMAL RULE LIST\n", "writing");

    // replace newlines with actual line breaks (otherwise it will display as \n characters)
    output.toString().split("\\n").forEach(function (value) {
      res.write(value + "\n");
    });

    // remove uploaded files
    exec("rm " + outpath + labelpath + minorpath, function (err, stdout, stderr) {
      if (err) throw err;
    });

    // end response
    res.end();
  });
})

// listen on port 8080
var server = app.listen(8080, function () {
  var host = server.address().address
  var port = server.address().port
})
