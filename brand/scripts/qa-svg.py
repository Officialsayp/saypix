"""Validate all deliverable SVGs and compare master path coefficients exactly."""
from pathlib import Path
import json,re,xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
ns='{http://www.w3.org/2000/svg}'
def tokens(d):return re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',d)
master=ET.parse(root/'master/logo-master-v1.svg').getroot()
locked=[tokens(p.attrib['d']) for p in master]
results=[]
for folder in ['master','svg','avatars','favicon','social']:
 for f in (root/folder).rglob('*.svg'):
  svg=ET.parse(f).getroot();assert svg.tag==ns+'svg'
  assert len(svg.attrib['viewBox'].split())==4
  assert float(svg.attrib['viewBox'].split()[2])>0
  ids=[el.attrib['id'] for el in svg.iter() if 'id' in el.attrib];assert len(ids)==len(set(ids))
  paths=[tokens(el.attrib['d']) for el in svg.iter(ns+'path')]
  assert all(p in paths for p in locked),f'Master path differs in {f}'
  for el in svg.iter():
   assert el.tag not in [ns+x for x in ['image','script','foreignObject','filter','linearGradient','radialGradient','text']]
   for key,value in el.attrib.items():
    assert not key.startswith('on')
    assert 'NaN' not in value and 'Infinity' not in value
    assert 'base64' not in value
    for ident in re.findall(r'url\(#([^)]+)\)',value):assert ident in ids
    assert not key.endswith('href')
  for el in svg.iter(ns+'path'):assert el.attrib['d'].strip(),f
  results.append({'file':str(f.relative_to(root)),'xmlValid':True,'lockedPathTokensPresent':True,'maskCount':len(list(svg.iter(ns+'mask')))})
(root/'tests/svg-validation.json').write_text(json.dumps(results,indent=2)+'\n')
print(f'PASS: {len(results)} SVGs; exact locked path tokens, no raster/scripts/filters, local references valid.')
