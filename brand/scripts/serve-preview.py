"""Local review server. No publishing and no access outside brand, except reference."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse

parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8765)
parser.add_argument('--reference',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
 def do_GET(self):
  if self.path=='/reference':
   if args.reference and args.reference.is_file():
    data=args.reference.read_bytes();self.send_response(200);self.send_header('Content-Type','image/png');self.end_headers();self.wfile.write(data)
   else:self.send_error(404,'Use --reference for the original image')
  else:super().do_GET()
print(f'Preview: http://127.0.0.1:{args.port}/previews/brand-preview.html',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
