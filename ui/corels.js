var http = require('http');
var util = require('util');
var formidable = require('formidable');
var exec = require('child_process').exec;

http.createServer(function (req, res) {
  if (req.url == '/fileupload') {
    var dir = "/tmp/corels/zips";
    exec("mkdir -p " + dir, {}, function (err, stdout, stderr) {
      if (err) throw err;
      console.log(stdout);
      console.log(stderr);
    });
    var form = new formidable.IncomingForm();
    form.uploadDir = dir;
    form.parse(req, function (err, fields, files) {
      var path = files.filetoupload._writeStream.path;
      var command = "python3 interface.py " + path;
      res.write("Optimal rule list:\n");
      exec(command, function (err, stdout, stderr) {
	if (err) throw err;
        stdout.toString().split("\\n").forEach(function (value) {
          res.write(value + "\n");
        });
        res.end();
      });
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<h1>CORELS Web Interface</h1>');
    res.write('<p>Please upload a zip file containing a .label file, a .out file, and a .minor file \(please see http:\/\/github.com\/nlarusstone\/corels for more details on the input format\).</p>');
    res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
    res.write('<input type="file" name="filetoupload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    return res.end();
  }
}).listen(8080);
