import zipfile, time, os, os.path, subprocess, sys, uuid

def extract_zip (z, dirname):
	with zipfile.ZipFile(z, 'r') as zf:
		os.makedirs(dirname, exist_ok=True)
		zipfile.ZipFile.extractall(zf, dirname)
		return [[f for f in os.listdir(dirname) if (os.path.isfile(os.path.join(dirname, f)))], dirname]

def get_corels_output (fp):
	p = fp[0]
	dirname = fp[1]
	for i in p:
		a = i.split('.')
		if a[1] == "out":
			out = dirname + i
		elif a[1] == "label":
			label = dirname + i
		elif a[1] == "minor":
			minor = dirname + i
	if (len(p) == 2):
		 minor = ""
	args = out + " " + label + " " + minor
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
