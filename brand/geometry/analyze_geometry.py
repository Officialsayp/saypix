"""Reproducible geometry-only QA. Reads the reference; creates no raster files.

Dependencies: numpy, scipy, Pillow, shapely, svgpathtools.
Run from any directory: python analyze_geometry.py [path/to/reference.png]
"""
from pathlib import Path
import hashlib
import json
import sys
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion
from scipy.spatial import cKDTree
from shapely import contains_xy
from shapely.geometry import LineString, Polygon, box
from svgpathtools import parse_path

ROOT = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python analyze_geometry.py path/to/reference.png')
REF = Path(sys.argv[1])
MASTER = ROOT / 'master/logo-master-v1.svg'
DATA = json.loads((ROOT / 'geometry/control-points.json').read_text())
tree = ET.parse(MASTER)
root = tree.getroot()
ns = '{http://www.w3.org/2000/svg}'
assert root.tag == ns + 'svg'
assert set(root.attrib) == {'viewBox', 'fill'}
assert 'width' not in root.attrib and 'height' not in root.attrib
elements = list(root)
assert len(elements) == 2 and all(el.tag == ns+'path' for el in elements)
assert all(set(el.attrib) == {'d'} for el in elements)
paths = [parse_path(el.attrib['d']) for el in elements]
assert all(p.isclosed() and len(p) == 12 for p in paths)
assert all(type(c).__name__ == 'CubicBezier' for p in paths for c in p)
assert all(np.isfinite([z.real, z.imag]).all() for p in paths for c in p for z in c.bpoints())


def polygon(path, n=1001):
    pts = np.concatenate([np.array([[z.real, z.imag] for z in (c.point(t) for t in np.linspace(0, 1, n, endpoint=False))]) for c in path])
    return Polygon(pts), pts


polygons, edge_points = zip(*(polygon(p) for p in paths))
assert all(p.is_valid and p.exterior.is_simple for p in polygons)
assert polygons[0].intersection(polygons[1]).area == 0
shape = polygons[0].union(polygons[1])
fine_shape = polygon(paths[0], 2001)[0].union(polygon(paths[1], 2001)[0])
assert abs(fine_shape.area-shape.area) < .1

bboxes = [p.bbox() for p in paths]
xmin=min(b[0] for b in bboxes); xmax=max(b[1] for b in bboxes)
ymin=min(b[2] for b in bboxes); ymax=max(b[3] for b in bboxes)
cx=(xmin+xmax)/2; cy=(ymin+ymax)/2
assert np.allclose((xmin,ymin,xmax,ymax), (60,60,1022,549), atol=1e-8, rtol=0)
assert np.allclose((cx,cy), (541,304.5), atol=1e-8, rtol=0)


def curvature(c, t):
    v=c.derivative(t); a=c.derivative(t, 2)
    return (v.real*a.imag-v.imag*a.real)/abs(v)**3


joins=[]
for si,p in enumerate(paths):
    for i,c in enumerate(p):
        prev=p[i-1]; angle=abs(float(np.degrees(np.angle(c.derivative(0)/prev.derivative(1)))))
        kin=curvature(prev,1); kout=curvature(c,0)
        cusp=i in DATA['shapes'][si]['cusps']
        joins.append({'path':DATA['shapes'][si]['name'],'anchor':i,'intentional_corner':cusp,
                      'position':[c.start.real,c.start.imag], 'tangent_deviation_degrees':angle,
                      'signed_curvature_in':kin,'signed_curvature_out':kout,'curvature_jump':abs(kin-kout)})
smooth=[j for j in joins if not j['intentional_corner']]
assert len(smooth)==20
assert max(j['tangent_deviation_degrees'] for j in smooth)<.003
assert max(j['curvature_jump'] for j in smooth)<.0006

# Read the source only. Pixel centers use x+.5 / y+.5; raster bounding boxes
# use occupied pixel cells. This avoids mixing pixel indices with coordinates.
rgb=np.array(Image.open(REF).convert('RGB')); mask=rgb.mean(2)>120
yy,xx=np.where(mask); source_bbox=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
height,width=mask.shape; grid_y,grid_x=np.mgrid[0:height,0:width]
sx,sy=DATA['translation_to_master']
vector_mask=contains_xy(shape,grid_x+.5+sx,grid_y+.5+sy)
boundary=mask & ~binary_erosion(mask)
by,bx=np.where(boundary); ref_edge=np.stack([bx+.5+sx,by+.5+sy],axis=-1)
vec_edge=np.concatenate(edge_points)
d1=cKDTree(ref_edge).query(vec_edge)[0];d2=cKDTree(vec_edge).query(ref_edge)[0]


def iou(a,b): return float((a&b).sum()/(a|b).sum())


def symmetry(m):
    crop=m[252:741,284:1246]
    left=m[252:741,284:550];right=m[252:741,980:1246][:,::-1]
    return {'full_horizontal_reflection_iou':iou(crop,crop[:,::-1]),
            'full_vertical_reflection_iou':iou(crop,crop[::-1]),
            'full_180_rotation_iou':iou(crop,crop[::-1,::-1]),
            'lateral_regions_reflection_iou':iou(left,right)}


def crossings(axis,value):
    out=[]
    for p in paths:
        for c in p:
            co=(c.poly().coeffs.real if axis=='x' else c.poly().coeffs.imag).copy()
            co[-1]-=value
            for t in np.roots(co):
                if abs(t.imag)<1e-7 and 0<=t.real<1:
                    z=c.point(t.real);out.append(float(z.imag if axis=='x' else z.real))
    return sorted(set(round(v,6) for v in out))


# Normal-section measurements: reference-coordinate centers/directions are
# explicit so these widths cannot be confused with constant-width strokes.
stations=[
 ('left top',0,(495,320),(0,1)),('right top',1,(1035,320),(0,1)),
 ('left side',0,(350,497),(1,0)),('right side',1,(1180,497),(1,0)),
 ('left bottom',0,(498,675),(0,1)),('right bottom',1,(1028,675),(0,1)),
 ('left upper approach',0,(650,388),(-.5,.8660254)),
 ('right upper approach',1,(880,388),(.5,.8660254)),
 ('left fold shoulder',0,(700,410),(-.4,.916515)),
 ('right fold shoulder',1,(825,620),(.6,.8)),
 ('lower central ribbon',0,(765,555),(.6,.8)),
 ('upper central ribbon',1,(765,465),(.6,.8)),
 ('left lower exit',0,(650,610),(.6,.8)),
 ('right upper exit',1,(880,400),(.6,.8)),
]
sections=[]
for name,si,pt,direction in stations:
    pt=np.array(pt,float)+[sx,sy];n=np.array(direction,float);n/=np.linalg.norm(n)
    line=LineString([pt-1000*n,pt+1000*n]); cut=polygons[si].intersection(line)
    pieces=list(cut.geoms) if hasattr(cut,'geoms') else [cut]
    selected=min(pieces,key=lambda c:c.distance(LineString([pt,pt+1e-7*n])))
    coords=list(selected.coords)
    sections.append({'name':name,'path':si,'center':pt.tolist(),'normal':n.tolist(),
                     'width':selected.length,'endpoints':[list(coords[0]),list(coords[-1])]})

source_centroid=[float(xx.mean()+.5),float(yy.mean()+.5)]
center_row=crossings('y',305)
metrics={
 'scope':'PHASE 1–5 only; no small-size, platform, color-system or export QA',
 'master_sha256':hashlib.sha256(MASTER.read_bytes()).hexdigest(),
 'reference_sha256':hashlib.sha256(REF.read_bytes()).hexdigest(),
 'source':{'size':[width,height],'threshold':'mean RGB > 120', 'bbox_pixel_cells':source_bbox,
           'centroid':source_centroid,'area_pixels':int(mask.sum()),'symmetry':symmetry(mask)},
 'master':{'bbox':[xmin,ymin,xmax,ymax],'viewBox':[0,0,1082,609], 'ink_size':[xmax-xmin,ymax-ymin],
           'ink_aspect_ratio':(xmax-xmin)/(ymax-ymin),'canvas_aspect_ratio':1082/609,
           'center':[cx,cy],'centroid':[shape.centroid.x,shape.centroid.y],
           'centroid_offset':[shape.centroid.x-cx,shape.centroid.y-cy],
           'left_area_fraction':shape.intersection(box(-1000,-1000,cx,2000)).area/shape.area,
           'area':shape.area,'area_sampling_error':abs(fine_shape.area-shape.area),
           'min_interpath_gap':polygons[0].distance(polygons[1]),
           'symmetry':symmetry(vector_mask), 'paths':2,'cubic_segments':24,
           'winding_signed_area':[p.area() for p in paths],
           'smooth_joins':20,'intentional_corners':4,
           'max_tangent_deviation_degrees':max(j['tangent_deviation_degrees'] for j in smooth),
           'max_curvature_jump':max(j['curvature_jump'] for j in smooth),
           'center_row_y':305,'center_row_crossings':center_row,
           'aperture_center_row_widths':[center_row[2]-center_row[1],center_row[4]-center_row[3]],
           'aperture_height':223},
 'fidelity':{'reference_mask_iou':iou(mask,vector_mask),
             'edge_rms':float(np.sqrt(np.mean(d1*d1))),
             'edge_p95':float(np.percentile(d1,95)),
             'edge_two_way_max':float(max(d1.max(),d2.max())),
             'note':'Sampled vector vs thresholded raster edge pixels; source antialias uncertainty ~1 px.'},
 'sections':sections,'joins':joins,
 'checks':{'xml_valid':True,'only_fill_paths':True,'closed_paths':True,'no_self_intersection_sampled':True,
           'no_interpath_overlap':True,'finite_coordinates':True,'centered_bounds':True,
           'g1_with_rounding_tolerance':True,'raster_assets_created':False}
}
(ROOT/'geometry/geometry-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps({k:metrics[k] for k in ['master','fidelity','checks']},indent=2))
