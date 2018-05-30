// builtin libraries
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

// external libraries
var express = require('express');
var randomstring = require("randomstring");
var SocketIOFile = require('socket.io-file');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var id_len = 10;

app.use(express.static(__dirname + '/node_modules'));

// create upload directory if it doesn't exist
var dir_upload_root = "/tmp/corels/files/";
exec("mkdir -p " + dir_upload_root, {}, function (err, stdout, stderr) {
 if (err) throw err;
});

app.use(express.static('public'));

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

//app.get('/socket.io.js', (req, res, next) => {
//  return res.sendFile(__dirname + '/node_modules/socket.io-client/dist/socket.io.js');
//});
  
//app.get('/socket.io-file-client.js', (req, res, next) => {
//  return res.sendFile(__dirname + '/node_modules/socket.io-file-client/socket.io-file-client.js');
//});

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

  socket.emit('console', '\nRunning corels\n');
  var corels = spawn(command, args, { shell: true });

  corels.on('close', function() {
    exec("rm -rf " + out_path + " " + label_path + " " + minor_path, {}, function(err, stdout, stderr) {
      if(err) console.log(err);
    });

    end();
  });
  corels.stderr.on('data', function(data) {
    socket.emit('console', data.toString());
  });
  corels.stdout.on('data', function(data) {
    socket.emit('console', data.toString());
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

  var corels_process = null;
  var mine_process = null;
  var minor_process = null;

  function done_run() {
    running = false;
    out_path = "";
    label_path = "";
    minor_path = "";
    socket.emit('done-run');
  }

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

    socket.emit('console', '\nRunning corels\n');
    corels_process = spawn(command, args, { shell: true });

    corels_process.on('close', function() {
      corels_process = null;
      exec("rm -rf " + out_path + " " + label_path + " " + minor_path, {}, function(err, stdout, stderr) {
        if(err) console.log(err);
      });

      end();
    });
    corels_process.stderr.on('data', function(data) {
      socket.emit('console', data.toString());
    });
    corels_process.stdout.on('data', function(data) {
      socket.emit('console', data.toString());
    });
  }

  uploader.on('start', function(fileInfo) {
    console.log("Begun uploading: ");
    console.log(fileInfo);
  });

  socket.on('reset', function() {
    running = false;
    if(minor_process)
      minor_process.kill();
    if(corels_process)
      corels_process.kill();
    if(mine_process)
      mine_process.kill();
    exec("rm -f " + dir_upload + "/*");
    socket.emit('console', '\nReset\n');
  });

  uploader.on('complete', function(fileInfo) {
    if(fileInfo.data.mine && fileInfo.data.type == "csv") {
      var csv_path = fileInfo.uploadDir;
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

      socket.emit('console', '\nRunning miner\n');
      mine_process = spawn(command, args, { shell: true });

      var fdata = Object.assign({}, fileInfo.data);

      mine_process.on('close', function() {
        mine_process = null;
        exec("rm -f " + csv_path, {}, function(err, stdout, stderr) {
          if(err) console.log(err);
        });

        if(fdata.make_minor) {
          var minor_args = [];
          minor_args.push(out_path);
          minor_args.push(label_path);

          minor_path = dir_upload + "/minor_file.minor";
          minor_args.push(minor_path);

          var minor_command = __dirname + "/../utils/minority";

          minor_process = spawn(minor_command, minor_args, { shell: true });

          minor_process.on('close', function() {
            minor_process = null;
            run_corels(fdata, out_path, label_path, minor_path, socket, function() {
              done_run();
            });
          });
          minor_process.stdout.on('data', function(data) {
            socket.emit('console', data.toString());
          });
          minor_process.stderr.on('data', function(data) {
            socket.emit('console', data.toString());
          });
        }
        else {
          run_corels(fdata, out_path, label_path, minor_path, socket, function() {
            done_run();
          });
        }
      });
      mine_process.stdout.on('data', function(data) {
        socket.emit('console', data.toString());
      });
      mine_process.stderr.on('data', function(data) {
        socket.emit('console', data.toString());
      });
    }
    else if(!fileInfo.data.mine && (fileInfo.data.type == "out" || fileInfo.data.type == "label" || fileInfo.data.type == "minor")) {
      if(fileInfo.data.type == "out")
        out_path = fileInfo.uploadDir;
      else if(fileInfo.data.type == "label")
        label_path = fileInfo.uploadDir;
      else if(fileInfo.data.type == "minor")
        minor_path = fileInfo.uploadDir;

      // use_minor is true only if a minor file is to be provided, and is independent of
      // make_minor, which instead indicates that the minority file be generated if not provided
      if(out_path && label_path && (!fileInfo.data.use_minor || minor_path)) {
        if(!fileInfo.data.use_minor && fileInfo.data.make_minor) {
          var minor_args = [];
          minor_args.push(out_path);
          minor_args.push(label_path);

          minor_path = dir_upload + "/minor_file.minor";
          minor_args.push(minor_path);

          var minor_command = __dirname + "/../utils/minority";

          minor_process = spawn(minor_command, minor_args, { shell: true });

          var fdata = Object.assign({}, fileInfo.data);

          minor_process.on('close', function() {
            minor_process = null;
            run_corels(fdata, out_path, label_path, minor_path, socket, function() {
              done_run();
            });
          });
          minor_process.stdout.on('data', function(data) {
            socket.emit('console', data.toString());
          });
          minor_process.stderr.on('data', function(data) {
            socket.emit('console', data.toString());
          });
        }
        else {
          run_corels(fileInfo.data, out_path, label_path, minor_path, socket, function() {
            done_run();
          });
        }
      }
    }
  });
});

server.listen(8080);
