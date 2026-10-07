# Turns the repo's index.html into the page body format the Claude preview expects.
import re,sys
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/airbus-log.html'
s=open('index.html').read()
head=s[s.index('<head>')+6:s.index('</head>')]
head=re.sub(r'<meta charset[^>]*>\n|<meta name="viewport"[^>]*>\n|<link rel="(manifest|apple-touch-icon|icon)"[^>]*>\n','',head)
body=s[s.index('<body'):]
body=body[body.index('>')+1:]
body=body[:body.rindex('</body>')]
out=head.strip()+"\n"+body.strip()+"\n"
out=re.sub(r'<meta [^>]*>\n','',out)
open(OUT,'w').write(out)
print("ok")
