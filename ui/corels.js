// builtin libraries
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

// external libraries
var express = require('express');
var multer = require('multer');
var bodyParser = require('body-parser');
var S = require('string');
var randomstring = require("randomstring");
var SocketIOFile = require('socket.io-file');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var id_len = 10;

// create upload directory if it doesn't exist
var dir_upload_root = "/tmp/corels/files/";
exec("mkdir -p " + dir_upload_root, {}, function (err, stdout, stderr) {
 if (err) throw err;
});

app.use(express.static('public'));

// parse text fields
//app.use(bodyParser.urlencoded({ extended: false }));

// parse files
//app.use(multer({ dest : dir_upload }).fields([{name: 'out'}, {name: 'label'}, {name: 'minor'}, {name: 'csv'}]));

var used_ids = [];

function nextid() {
  var s;

  s = randomstring.generate(id_len);
  while(used_ids.includes(s))
    s = randomstring.generate(id_len);

  used_ids.push(s);
  return s;
}

// display form
app.get('/', function (req, res) {
  return res.sendFile(__dirname + '/form.html');
});

/*app.get('/app.js', (req, res, next) => {
  return res.sendFile(__dirname + '/client/app.js');
});*/
 
app.get('/socket.io.js', (req, res, next) => {
  return res.sendFile(__dirname + '/node_modules/socket.io-client/dist/socket.io.js');
});
  
app.get('/socket.io-file-client.js', (req, res, next) => {
  return res.sendFile(__dirname + '/node_modules/socket.io-file-client/socket.io-file-client.js');
});

function run_corels(params, out_path, label_path, minor_path, socket, end) {
  var args = [];
  var command = __dirname + "/../corels/src/corels";
  
  args.push("-r " + params.regularization);
  args.push("-n " + params.max_nodes);
  args.push("-v " + params.verbosity);
  args.push(params.search_policy);
  args.push(params.prefix_map);
  args.push(out_path);
  args.push(label_path);
  if(minor_path)
    args.push(minor_path);
  console.log(params.verbosity);

  socket.emit('console', '\nRunning corels\n');
  var corels = spawn(command, args, { shell: true });

  corels.on('close', function() {
    exec("rm -rf " + out_path + " " + label_path + " " + minor_path, {}, function(err, stdout, stderr) {
      if(err) console.log(err);
    });

    end();
  });
  corels.stderr.on('data', function(data) {
    console.log(data.toString());
  });
  corels.stdout.on('data', function(data) {
    socket.emit('console', data.toString());
    console.log(data.toString());
  });
}

io.on('connection', function(socket) {
  var id = nextid();
  var dir_upload = dir_upload_root + id;
  var uploader = new SocketIOFile(socket, {
    uploadDir: dir_upload,
    chunkSize: 1024,
    transmissionDelay: 0,
    overwrite: true
  });

  socket.on('disconnect', function() {
    exec("rm -rf " + dir_upload, {}, function(err, stdout, stderr) {
      if(err) console.log(err);
    });
  });

  socket.on('start-run', function() {
    running = true;
    socket.emit('console', '\nUploading files...\n');
    socket.emit('start-run-confirm');
  });

  var running = false;
  var complete_files = [];
  var out_path = "";
  var label_path = "";
  var minor_path = "";

  uploader.on('start', function(fileInfo) {
    console.log(fileInfo);
  });

  socket.on('reset', function() {
    running = false;
    socket.emit('console', '\nReset\n');
  });

  uploader.on('complete', function(fileInfo) {
    if(fileInfo.data.mine && fileInfo.data.type == "csv") {
      var csv_path = fileInfo.uploadDir;
      console.log(csv_path);
      out_path = dir_upload + "/out_file.out";
      label_path = dir_upload + "/label_file.label";
      minor_path = "";

      var args = [];
      args.push("-c " + fileInfo.data.max_card);
      args.push("-s " + fileInfo.data.min_support);
      args.push(csv_path);
      args.push(out_path);
      args.push(label_path);
      var command = __dirname + "/../utils/mine";

      console.log(out_path);

      socket.emit('console', '\nRunning miner\n');
      var mine = spawn(command, args, { shell: true });

      mine.on('close', function() {
        exec("rm -f " + csv_path, {}, function(err, stdout, stderr) {
          if(err) console.log(err);
        });
      
        run_corels(fileInfo.data, out_path, label_path, minor_path, socket, function() {
          running = false;
          out_path = "";
          label_path = "";
          minor_path = "";
          socket.emit('done-run');
        });
      });
      mine.stdout.on('data', function(data) {
        socket.emit('console', data.toString());
        console.log(data.toString());
      });
    }
    else if(!fileInfo.data.mine && (fileInfo.data.type == "out" || fileInfo.data.type == "label" || fileInfo.data.type == "minor")) {
      if(fileInfo.data.type == "out")
        out_path = fileInfo.uploadDir;
      else if(fileInfo.data.type == "label")
        label_path = fileInfo.uploadDir;
      else if(fileInfo.data.type == "minor")
        minor_path = fileInfo.uploadDir;

      if(out_path && label_path && (!fileInfo.data.use_minor || minor_path)) {
        run_corels(fileInfo.data, out_path, label_path, minor_path, socket, function() {
          running = false;
          out_path = "";
          label_path = "";
          minor_path = "";
          socket.emit('done-run');
        });
      }
    }
  });
});

/*
function corels() {
  queue_copy = corels_queue.slice(0);

  var idx_shift = 0;
  queue_copy.forEach(function(e, e_idx) {
    out_path = e.id + ".out";
    label_path = e.id + ".label";
    minor_path = "";

    if(e.use_minor)
      minor_path = e.id + ".minor";

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


function mine() {
  queue_copy = mine_queue.slice(0);

  var idx_shift = 0;
  queue_copy.forEach(function(e, e_idx) {
    csv_path = dir_upload + e.id + ".csv";
    out_path = dir_upload + e.id + ".out";
    label_path = dir_upload + e.id + ".label";

    if(complete_files.contains(e.id + ".csv")) {
      min_support = e.min_support;
      max_card = e.max_card;	

      var command = __dirname + "/../utils/mine -c " + max_card + " -s " + min_support +
                    " " + csv_path + " " + out_path + " " + label_path + " " + minor_path;

      console.log(command);
      
      var i = complete_files.indexOf(e.id + ".csv");
      if(i != -1) 
        complete_files.splice(i, 1);

      mine_queue = mine_queue.splice(e_idx - idx_shift, 1);
      idx_shift += 1;

      exec(command, function(err, stdout, stderr) {
        if(err) { console.log(err); }
         
        exec("rm -f " + csv_path, function(err, stdout, stderr) {
          if(err) { console.log(err); }
        });

        //run_corels(req, res, out_path, label_path, minor_path);
      });
    }
  }
});

function run_corels(req, res, out_path, label_path, minor_path)
{
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
}*/

// listen on port 8080
server.listen(8080, function () {
  var host = server.address().address
  var port = server.address().port
});
