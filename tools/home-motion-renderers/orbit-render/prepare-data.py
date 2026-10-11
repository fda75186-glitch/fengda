from pathlib import Path
import json
import shutil
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent
src = root / 'source-data'
out = root / 'public' / 'textures'
out.mkdir(parents=True, exist_ok=True)

# Format conversion only: the albedo pixels are NASA's supplied mosaic.
Image.open(src / 'moon-color-8k.tif').convert('RGB').save(out / 'moon-albedo.jpg', quality=97, subsampling=0)
dem = np.asarray(Image.open(src / 'moon-dem-16.tif'), dtype=np.uint16)
dem.astype('<u2').tofile(out / 'moon-elevation.u16')
h, w = dem.shape
height_m = dem.astype(np.float32) * 0.5 - 10000.0
radius_m = 1737400.0
lat = np.linspace(np.pi / 2, -np.pi / 2, h, dtype=np.float32)
dx = 2 * np.pi * radius_m * np.maximum(np.cos(lat), 0.08)[:, None] / w
dy = np.pi * radius_m / h
gx = (np.roll(height_m, -1, axis=1) - np.roll(height_m, 1, axis=1)) / (2 * dx)
gy = np.gradient(height_m, axis=0) / dy
normal = np.stack([-gx, gy, np.ones_like(gx)], axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
pixels = np.clip((normal * 0.5 + 0.5) * 255, 0, 255).astype(np.uint8)
Image.fromarray(pixels, 'RGB').save(out / 'moon-normal.png', optimize=True)
(out / 'moon-elevation.json').write_text(json.dumps({'width': w, 'height': h, 'unit': 'unsigned 16-bit little endian; 0.5 m above 1727400 m reference radius', 'moonRadiusM': radius_m}), encoding='utf-8')
release = Path(__file__).resolve().parents[3] / 'public/textures'
for name in ['2k_earth_daymap.jpg', '2k_earth_clouds.jpg']:
    shutil.copy2(release / name, out / name)
print(json.dumps({'DEM': [w, h], 'assets': {p.name: p.stat().st_size for p in out.iterdir()}}, ensure_ascii=True))
