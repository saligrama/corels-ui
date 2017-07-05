import zipfile, time, os, os.path, subprocess, sys, uuid

def extract_zip (z, dirname):
	with zipfile.ZipFile(z, 'r') as zf:
		os.makedirs(dirname, exist_ok=True)
		zipfile.ZipFile.extractall(zf, dirname)
		return [[f for f in os.listdir(dirname) if (os.path.isfile(os.path.join(dirname, f)))], dirname]

def get_corels_output (fp):
	p = fp[0]
	p.sort()
	dirname = fp[1]
	label = p[0]
	if len(p) == 1:
		out = p[1]
		minor = ""
	else:
		out = p[2]
		minor = p[1]
	args = dirname + out + " " + dirname + label + " " + dirname + minor
	command = "../corels/src/corels -r 0.015 -c 2 -p 1 " + args
	corels_output = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=None, shell=True).communicate()
	return filter(corels_output)

def filter (o):
	output = str(o[0])
	searchstr = "OPTIMAL RULE LIST"
	start_pos = output.index(searchstr) + len(searchstr)
	end_pos = output.index("writing", start_pos)
	return output[start_pos+2:end_pos-4] # there will be one leading newline and two trailing newlines that need to be stripped

def main ():
	zippath = sys.argv[1]
	extpath = "/tmp/corels/extracts/" + zippath[-32:] + "/"
	print(get_corels_output(extract_zip(zippath, extpath)))
	subprocess.Popen("rm -rf " + zippath + " " + extpath, shell=True)
	sys.stdout.flush()

main()
