// builtin libraries
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

// external libraries
var express = require('express');
var multer = require('multer');
var bodyParser = require('body-parser');
var S = require('string');

var app = express();

// create upload directory if it doesn't exist
var dir_upload = "/tmp/corels/files/";
exec("mkdir -p " + dir_upload, {}, function (err, stdout, stderr) {
 if (err) throw err;
});

app.use(express.static('public'));

// parse text fields
app.use(bodyParser.urlencoded({ extended: false }));

// parse files
app.use(multer({ dest : dir_upload }).fields([{name: 'out'}, {name: 'label'}, {name: 'minor'}, {name: 'csv'}]));

// display form
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/form.html');
});

app.post('/fileupload', function (req, res) {

  res.writeHead(200, {'Content-Type': 'text/plain', 'Transfer-Encoding': 'chunked'});

  var out_path = "", label_path = "", minor_path = "", csv_path = "";

  if(req.files.out)
    out_path = req.files.out[0].path;
  if(req.files.label)
    label_path = req.files.label[0].path;
  if(req.files.minor)
    minor_path = req.files.minor[0].path;

  if(req.files.csv)
    csv_path = req.files.csv[0].path;

  if(csv_path) {
    out_path = dir_upload + "data.out";
    label_path = dir_upload + "data.label";

    if(req.body.make_minor)
      minor_path = dir_upload + "data.minor";
    else
      minor_path = "";

    var command = __dirname + "/../utils/convcsv " + csv_path + " " + out_path + " " + label_path + " " + minor_path;
    exec(command, function(err, stdout, stderr) {
      if (err) throw err;
    });
  }

  // add parameters to array
  var args = [];
  var vopt = false;
  var vstr = "";
  var keys = Object.keys(req.body), len = keys.length, i = 0;
  while (i < len) {
    var arg = keys[i];
    if (arg == "regularization") {
      args.push("-r " + req.body[arg]);
    } else if (arg == "max_nodes") {
      args.push("-n " + req.body[arg]);
    } else if (S("rule|label|samples|progress|log").contains(arg)) {
      if (!vopt) {
        args.push("-v");
        vopt = true;
      }
      vstr += req.body[arg];
      if (i < len - 1) vstr += ",";
      else args.push(vstr);
    } else if (arg != "submit") {
      args.push(req.body[arg]);
    }
    i++;
  }

  if (!vopt) {
    args.push("-v");
    args.push("silent");
  }
  // get input file paths
  args.push(out_path);
  args.push(label_path);
  if (minor_path) args.push(minor_path);

  // run CORELS command
  var command = __dirname + "/../corels/src/corels";

  var corels = spawn(command, args, { shell: true, env: { 'LD_LIBRARY_PATH': '/usr/local/lib:/usr/lib:/usr/local/lib64:/usr/lib64' }});
  corels.stdout.on('data', function (data) {
    res.write(data.toString());
  });
  corels.on('close', function () {
    res.write("\n----------DONE----------");
    res.end();
    exec("rm -rf " + out_path + " " + label_path + " " + minor_path, {}, function (err, stdout, stderr) {
      if (err) throw err;
    });
  });
});

// listen on port 8080
var server = app.listen(8080, function () {
  var host = server.address().address
  var port = server.address().port
});
