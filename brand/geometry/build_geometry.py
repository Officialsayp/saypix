"""PHASE 1–5: manually authored cubic geometry; no bitmap tracing or raster exports."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
# Reference coordinates are retained during construction. Each row contains
# the two handles and endpoint of a cubic; all anchors/handles are authored.
# Translation into the centered master canvas is baked into the path data.
SHAPES = [{'name': 'left-ribbon',
  'start': [745, 416],
  'curves': [[[666.41, 340.285], [598.834, 252.0], [495, 252]],
             [[374.888, 252.0], [284.0, 363.64], [284, 497]],
             [[284.0, 628.795], [371.752, 741.0], [489, 741]],
             [[610.552, 741.0], [729.539, 610.511], [796, 568]],
             [[844.648, 536.883], [885.43, 540.029], [927, 559]],
             [[890.86, 524.67], [854.854, 511.0], [837, 511]],
             [[817.871, 511.0], [741.547, 526.703], [711, 534]],
             [[602.328, 559.959], [551.552, 612.0], [498, 612]],
             [[438.324, 612.0], [415.0, 546.575], [415, 497]],
             [[415.0, 442.393], [443.097, 389.0], [495, 389]],
             [[542.514, 389.0], [576.154, 433.912], [606, 449]],
             [[643.871, 468.145], [695.317, 449.211], [745, 416]]],
  'cusps': [0, 5]},
 {'name': 'right-ribbon',
  'start': [599, 454],
  'curves': [[[638.011, 490.055], [664.545, 522.0], [710, 522]],
             [[734.271, 522.0], [785.103, 512.891], [816, 502]],
             [[897.205, 473.375], [964.652, 389.0], [1035, 389]],
             [[1097.99, 389.0], [1115.0, 455.554], [1115, 497]],
             [[1115.0, 555.736], [1079.957, 612.0], [1028, 612]],
             [[985.232, 612.0], [947.473, 574.261], [924, 563.5]],
             [[886.428, 546.275], [819.603, 568.026], [768, 609]],
             [[858.447, 707.824], [976.6, 741.0], [1041, 741]],
             [[1158.248, 741.0], [1246.0, 628.795], [1246, 497]],
             [[1246.0, 363.64], [1155.112, 252.0], [1035, 252]],
             [[919.93, 252.0], [832.611, 360.784], [745, 433]],
             [[706.932, 464.378], [665.9, 490.916], [599, 454]]],
  'cusps': [0, 7]}]

SHIFT = (-224, -192)
VIEWBOX = (0, 0, 1082, 609)


def num(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


def xy(p, shift=SHIFT):
    return " ".join(num(p[i] + shift[i]) for i in range(2))


def path_data(shape, shift=SHIFT):
    return "M " + xy(shape["start"], shift) + "\n    " + "\n    ".join(
        "C " + " ".join(xy(p, shift) for p in curve)
        for curve in shape["curves"]
    ) + " Z"


def main():
    if (ROOT / "master/master-lock.json").exists():
        raise SystemExit("MASTER LOCKED: geometry regeneration is disabled. Use the approved SVG.")
    body = "\n".join(f'  <path d="{path_data(s)}"/>' for s in SHAPES)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(map(str, VIEWBOX))}" fill="#c4c4c4">\n{body}\n</svg>\n'
    (ROOT / "master/logo-master-v1.svg").write_text(svg)
    model = {"coordinate_system": "source pixels", "translation_to_master": SHIFT,
             "viewBox": VIEWBOX, "shapes": SHAPES}
    (ROOT / "geometry/control-points.json").write_text(json.dumps(model, indent=2) + "\n")
    print("Built logo-master-v1.svg: 2 closed contours, 24 cubic segments.")


if __name__ == "__main__":
    main()
