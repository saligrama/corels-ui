var http = require('http');
var util = require('util');
var formidable = require('formidable');
var exec = require('child_process').exec;
var ps = require('python-shell');

http.createServer(function (req, res) {
  if (req.url == '/fileupload') {
    var form = new formidable.IncomingForm();
    form.uploadDir = "/tmp/corels/zips"
    form.parse(req, function (err, fields, files) {
      var path = files.filetoupload._writeStream.path;
      res.write("Optimal rule list:\n");
      ps.run("interface.py", { args: [path] }, function (err, data) {
	if (err) throw err;
	data.toString().split("\\n").forEach(function (value) {
	  res.write(value + "\n");
	});
	res.end();
      });
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<form action="fileupload" method="post" enctype="multipart/form-data">');
    res.write('<input type="file" name="filetoupload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    return res.end();
  }
}).listen(8080);
