"""Build the geometry review board from the same master paths; no raster output."""
from pathlib import Path
from html import escape
import json
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
model=json.loads((ROOT/'geometry/control-points.json').read_text())
metrics=json.loads((ROOT/'geometry/geometry-metrics.json').read_text())
elements=list(ET.parse(ROOT/'master/logo-master-v1.svg').getroot())
paths=''.join('<path d="'+el.attrib['d']+'"/>' for el in elements)
sx,sy=model['translation_to_master']
def point(p):return (p[0]+sx,p[1]+sy)
def fmt(p):return f'{p[0]:.3f},{p[1]:.3f}'
handles=[];anchors=[]
for si,shape in enumerate(model['shapes']):
    start=point(shape['start'])
    for i,c in enumerate(shape['curves']):
        a,b,end=map(point,c)
        handles.append(f'<path d="M{fmt(start)} L{fmt(a)} M{fmt(b)} L{fmt(end)}"/>')
        handles.extend(f'<circle cx="{p[0]}" cy="{p[1]}" r="2.2"/>' for p in [a,b])
        col='#f0b17b' if i in shape['cusps'] else '#b9dcc6'
        anchors.append(f'<circle cx="{start[0]}" cy="{start[1]}" r="3.8" fill="{col}" stroke="#15201a" stroke-width="1"/>')
        anchors.append(f'<text x="{start[0]+7}" y="{start[1]-7}" fill="{col}" font-size="11">{"L" if si==0 else "R"}{i}</text>')
        start=end
controls='<g fill="none" stroke="#9bc2aa" stroke-width=".9">'+''.join(handles)+'</g>'+''.join(anchors)
axes='''<g fill="none" stroke="#9bc2aa" stroke-width="1" stroke-dasharray="5 6">
<rect x="60" y="60" width="962" height="489"/><path d="M541 24V585M24 304.5H1058"/>
</g><g fill="#b9dcc6" font-size="13"><text x="541" y="37" text-anchor="middle">962 u</text><text x="1038" y="308">489 u</text>
<text x="548" y="590">C = (541, 304.5)</text></g>'''
mass=metrics['master']['centroid']
axes+=f'<circle cx="{mass[0]}" cy="{mass[1]}" r="3" fill="#f0b17b"/>'
sections='<g fill="none" stroke="#b9dcc6" stroke-width="1.1">'
for s in metrics['sections'][:6]:
    a,b=s['endpoints'];sections+=f'<path d="M{fmt(a)}L{fmt(b)}"/>'
sections+='</g>'
ink=f'<g fill="#c4c4c4">{paths}</g>'
mirror=f'<g fill="none" stroke="#f0b17b" stroke-width="1.5" transform="translate(1082 0) scale(-1 1)">{paths}</g>'
preview=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1200">
<rect width="1400" height="1200" fill="#171916"/>
<g font-family="Arial, sans-serif">
<text x="64" y="52" fill="#a7bea7" font-size="13" letter-spacing="2">MASTER V1 / GEOMETRY REVIEW / PHASE 1–5</text>
<text x="64" y="101" fill="#ebeee7" font-size="34">Одна лента. Сохранённый характер.</text>
<text x="64" y="135" fill="#a6aca1" font-size="17">24 cubic Bézier · 20 плавных стыков · 4 конструктивных угла</text>
<svg x="159" y="155" width="1082" height="609" viewBox="0 0 1082 609">{ink}{axes}<g opacity=".65">{controls}</g></svg>
<path d="M64 790H1336" stroke="#3b4438"/>
<text x="64" y="831" fill="#d7e3cf" font-size="18">Центральный разворот · ×2</text>
<svg x="64" y="850" width="610" height="240" viewBox="365 207 370 183">{ink}<g opacity=".65">{controls}</g></svg>
<text x="748" y="831" fill="#d7e3cf" font-size="18">Контроль отражением</text>
<svg x="748" y="850" width="588" height="260" viewBox="0 0 1082 609">{ink}{mirror}</svg>
<text x="748" y="1131" fill="#a6aca1" font-size="14">Тёплый контур — отражение; различия центра сохранены.</text>
<text x="64" y="1167" fill="#b9c7b1" font-size="13">APPROVED / LOCKED · Геометрия утверждена. Этот лист документирует геометрию PHASE 1–5.</text>
</g></svg>'''
(ROOT/'previews/geometry-preview.svg').write_text(preview+'\n')

stat=metrics['master'];fidelity=metrics['fidelity']
row_cross=stat['aperture_center_row_widths']
html=f'''<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logo master v1 · Geometry review</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#111310;color:#e8ece3;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:1320px;margin:auto;padding:40px}}h1{{font-size:34px;font-weight:550;letter-spacing:-1px;margin:10px 0}}h2{{font-size:19px;font-weight:500;margin:8px 0 16px}}.eyebrow,.tag{{color:#afc2a5;font:12px/1.5 monospace;letter-spacing:1.4px}}p{{color:#a8afa1;max-width:850px}}.hero,.card{{background:#1d1f1b;border:1px solid #363d31;border-radius:8px}}.hero{{padding:25px 35px;margin-top:28px}}.hero img{{width:100%;height:auto;display:block}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}}.card{{padding:22px;min-width:0}}svg{{display:block;width:100%;height:auto}}.metrics{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:26px 0}}.metric{{padding:14px 0;border-top:1px solid #363d31}}.metric strong{{display:block;font-size:25px;font-weight:500}}.metric span{{color:#a8afa1;font-size:13px}}.controls{{display:flex;flex-wrap:wrap;gap:20px;align-items:center;padding:12px 0}}label{{cursor:pointer;color:#c6d0bd}}input{{accent-color:#b2d496}}input:focus-visible,a:focus-visible{{outline:2px solid #cbeaaf;outline-offset:4px}}.stage{{background:#1d1d1b;border-radius:6px;overflow:hidden}}.stage .points,.stage .dimensions,.stage .ref-overlay{{display:none}}#points:checked~.stage .points,#dimensions:checked~.stage .dimensions,#reference:checked~.stage .ref-overlay{{display:inline}}#reference:checked~.stage .master-ink{{opacity:.35;fill:#85d2bc}}.ref-overlay{{opacity:.8}}.stage .master-ink{{fill:#c4c4c4}}.switch{{display:inline-flex;align-items:center;gap:6px;margin:0 22px 15px 4px}}a{{color:#c9dfba;text-underline-offset:4px}}.note{{font-size:13px;color:#a8afa1}}footer{{border-top:1px solid #363d31;margin-top:32px;padding-top:24px;color:#a8afa1}}.links{{display:flex;flex-wrap:wrap;gap:24px}}.reference-note{{color:#a8afa1;font-size:12px}}@media(max-width:700px){{main{{padding:24px 16px}}h1{{font-size:27px}}.grid{{grid-template-columns:1fr}}.hero{{padding:20px 0}}.metrics{{grid-template-columns:1fr 1fr}}.card{{padding:16px}}.switch{{margin-right:10px;font-size:13px}}}}
</style>
<main>
<div class="eyebrow">MASTER V1 / PHASE 1–5 / APPROVED / LOCKED</div>
<h1>Одна лента. Сохранённый характер.</h1>
<p>Векторная реконструкция прикреплённого эталона. Сохранены вытянутые петли, центральный диагональный разворот и его конструктивная асимметрия. Цвет и фон здесь служат для оценки геометрии.</p>
<div class="hero"><img src="../master/logo-master-v1.svg" alt="Master v1: знак бесконечности с плавным разворотом ленты"></div>
<div class="metrics">
<div class="metric"><strong>962 × 489</strong><span>габарит знака, u</span></div>
<div class="metric"><strong>24 / 20 / 4</strong><span>кривые / плавные стыки / углы</span></div>
<div class="metric"><strong>{100*fidelity['reference_mask_iou']:.2f}%</strong><span>совпадение с исходником, IoU</span></div>
<div class="metric"><strong>49,20 / 50,80</strong><span>площадь слева / справа, %</span></div>
</div>
<section class="card"><span class="tag">01 / GEOMETRY</span><h2>Контуры, опорные точки и наложение</h2>
<input type="checkbox" id="points"><label class="switch" for="points">Опорные точки</label>
<input type="checkbox" id="dimensions" checked><label class="switch" for="dimensions">Оси и габариты</label>
<input type="checkbox" id="reference"><label class="switch" for="reference">Наложить на исходник</label>
<div class="stage"><svg viewBox="0 0 1082 609" role="img" aria-label="Интерактивная схема геометрии мастера">
<image class="ref-overlay reference-image" href="../../../../../мое лого.png" x="-224" y="-192" width="1536" height="1024"/>
<g class="master-ink">{paths}</g><g class="dimensions">{axes}{sections}</g><g class="points">{controls}</g>
</svg></div>
<p class="note">Зелёные точки — плавные соединения. Тёплые — четыре намеренных угла перекрута. Наложение показывает исходное изображение и полупрозрачную векторную заливку в одном масштабе.</p></section>
<div class="grid">
<section class="card"><span class="tag">02 / REFERENCE</span><h2>Утверждённый исходник</h2><svg viewBox="224 192 1082 609" role="img" aria-label="Прикреплённый исходник в том же масштабе"><image class="reference-image" href="../../../../../мое лого.png" width="1536" height="1024"/></svg><p class="reference-note">Ссылка на оригинал «мое лого.png» на вашем компьютере; PNG не копируется и не встраивается в SVG-мастер.</p></section>
<section class="card"><span class="tag">03 / REFLECTION</span><h2>Симметрия и намеренные различия</h2><svg viewBox="0 0 1082 609" role="img" aria-label="Мастер с отражённым контуром">{ink}{mirror}</svg><p class="note">Тёплый контур — горизонтальное отражение. Внешние боковые дуги совпадают точно; центр сохраняет over/under-рисунок.</p></section>
</div>
<div class="grid">
<section class="card"><span class="tag">04 / TWIST</span><h2>Центр крупным планом</h2><svg viewBox="365 207 370 183" role="img" aria-label="Увеличенная геометрия центрального разворота">{ink}</svg><p class="note">Две замкнутые заливки без масок и наложений. Минимальное расстояние между контурами — {stat['min_interpath_gap']:.2f} u. Острые окончания складок сохранены.</p></section>
<section class="card"><span class="tag">05 / OPTICAL BALANCE</span><h2>Что выровнено, что сохранено</h2><p>Габарит и поля центрированы математически. Верхние и нижние экстремумы внешних петель согласованы. Внутренние чаши сохраняют небольшие различия референса.</p><p>Центроид площади смещён на +{stat['centroid_offset'][0]:.2f} u вправо и +{stat['centroid_offset'][1]:.2f} u вниз — близко к исходнику. Дополнительное оптическое смещение не применялось.</p><p class="note">Полная G2-непрерывность не заявляется. Максимальный разрыв кривизны на плавных стыках — {stat['max_curvature_jump']:.6f} u⁻¹; максимальное угловое отклонение касательных — {stat['max_tangent_deviation_degrees']:.5f}°.</p></section>
</div>
<footer><div class="links"><a href="../master/logo-master-v1.svg">Открыть master SVG</a><a href="geometry-preview.svg">Векторный geometry preview</a><a href="../geometry-report.md">Геометрический отчёт</a></div><p>MASTER LOGO STATUS: APPROVED / LOCKED. Геометрия утверждена; мастер зафиксирован для производных материалов.</p></footer>
</main>
<script>if(location.protocol==='http:'||location.protocol==='https:'){{document.querySelectorAll('.reference-image').forEach(el=>el.setAttribute('href','/reference'));}}</script>
</html>'''
(ROOT/'previews/geometry-preview.html').write_text(html+'\n')
print('Built geometry-preview.svg and geometry-preview.html.')
