# Usage: python tools/make-earth.py  (writes assets/globe-earth.png from assets/countries.json; needs numpy and Pillow)
# Builds a pixel-art equirectangular earth map from assets/countries.json (Natural Earth outlines),
# so the globe's land lines up exactly with the country outlines the site draws on top.
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = (sys.argv[1:3] + ["assets/countries.json", "assets/globe-earth.png"][len(sys.argv) - 1:])[:2]
W, H = 1024, 512          # map pixels (each becomes a 2x2 block in the final 2048x1024 file)
SS = 4                    # supersampling for clean coastlines
C = json.load(open(SRC))

def xy(lon, lat, w, h):
    return ((lon + 180) / 360 * w, (90 - lat) / 180 * h)

# --- land mask and per-country id map -------------------------------------------------------------
big = Image.new('L', (W * SS, H * SS), 0)
bd = ImageDraw.Draw(big)
ids = Image.new('I', (W, H), 0)
idd = ImageDraw.Draw(ids)
names = sorted(C)
def unwrap(ring):
    # makes longitudes continuous across the date line; a ring that circles a pole is closed through that pole
    out = [list(ring[0])]
    for lo_, la_ in ring[1:]:
        p = out[-1][0]
        while lo_ - p > 180: lo_ -= 360
        while lo_ - p < -180: lo_ += 360
        out.append([lo_, la_])
    span = max(q[0] for q in out) - min(q[0] for q in out)
    if span > 350 and abs(out[0][0] - out[-1][0]) > 300:
        pole = -90 if sum(q[1] for q in out) < 0 else 90
        out += [[out[-1][0], pole], [out[0][0], pole]]
    return out

for k, name in enumerate(names, 1):
    for ring in C[name]:
        if len(ring) < 3:
            continue
        u = unwrap(ring)
        for sh in (-360, 0, 360):
            bd.polygon([xy(lo + sh, la, W * SS, H * SS) for lo, la in u], fill=255)
            idd.polygon([xy(lo + sh, la, W, H) for lo, la in u], fill=k)
land = np.array(big.resize((W, H), Image.BOX)) > 110
cid = np.array(ids)
# Antarctica's ring may not reach the pole: fill everything south of -84 as land
lat = 90 - (np.arange(H) + 0.5) / H * 180
lon = (np.arange(W) + 0.5) / W * 360 - 180
LAT, LON = np.meshgrid(lat, lon, indexing='ij')
land |= LAT < -78

# --- smooth value noise for natural edges ------------------------------------------------------------
rng = np.random.default_rng(7)
def noise(cells, seed):
    r = np.random.default_rng(seed).random((cells // 2 + 1, cells + 1)).astype(np.float32)
    im = Image.fromarray((r * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    return np.array(im) / 255.0
n1 = noise(48, 1)
n2 = noise(160, 2)
N = 0.65 * n1 + 0.35 * n2           # 0..1

# --- palette --------------------------------------------------------------------------------------------
P = {k: np.array([int(v[i:i + 2], 16) for i in (1, 3, 5)], np.uint8) for k, v in {
    'deep': '#173563', 'ocean': '#1f4580', 'mid': '#285894', 'shallow': '#3271a8', 'coast': '#4a92c2',
    'ice_sea': '#c9dbe6',
    'rain': '#2f6b3a', 'forest': '#3f8043', 'grass': '#62a14c', 'grass2': '#7db257', 'savanna': '#b0a95c',
    'steppe': '#a99f6b', 'desert': '#dcbc7c', 'desert2': '#e8cf95', 'boreal': '#355e3f', 'tundra': '#8d9a80',
    'snow': '#eef3f7', 'snow2': '#d5e1ea', 'border': '#000000',
}.items()}

img = np.zeros((H, W, 3), np.uint8)

# --- ocean: depth bands from distance to the coast ------------------------------------------------
lm = Image.fromarray((land * 255).astype(np.uint8))
def grow(px):
    # round growth: blur the mask and keep everything within about px/2 pixels of land
    b = np.array(lm.filter(ImageFilter.GaussianBlur(px / 2.2)))
    return (b > 18) | land
d1, d2, d3 = grow(3), grow(9), grow(19)
img[:] = P['deep']
img[d3 & ~land] = P['ocean']
img[d2 & ~land] = P['mid']
img[d1 & ~land] = P['shallow']
# a faint dithered sparkle in open water
spark = (n2 > 0.86) & ~d3 & (np.indices((H, W)).sum(0) % 2 == 0)
img[spark] = P['ocean']
# polar sea ice
img[(LAT > 80 + 3 * N) & ~land] = P['ice_sea']
img[(LAT < -70 - 3 * N) & ~land] = P['ice_sea']

# --- land biomes ------------------------------------------------------------------------------------------
la = LAT + (N - 0.5) * 6     # wobbly latitude so bands don't look ruled
lo = LON + (N - 0.5) * 6
def box(a, b, c, d):          # lat a..b, lon c..d
    return (la >= a) & (la <= b) & (lo >= c) & (lo <= d)

biome = np.full((H, W), 'grass', object)
biome[(np.abs(la) < 40) & (N > 0.55)] = 'grass2'
biome[(np.abs(la) >= 40) & (N > 0.5)] = 'forest'
biome[np.abs(la) < 9] = 'rain'
biome[(la > 48) & (la <= 62)] = 'boreal'
biome[(la > 62)] = 'tundra'
biome[(la < -42) & (N > 0.45)] = 'steppe'
sav = (box(8, 16, -18, 45) | box(-20, -9, 12, 42) | box(-21, -8, -58, -40) | box(14, 28, 70, 86)
       | box(-34, -14, 113, 154) | box(18, 30, -106, -96) | box(-38, -28, -66, -57))
biome[sav] = 'savanna'
steppe = box(42, 52, 45, 90) | box(30, 49, -112, -97) | box(-48, -38, -71, -64)
biome[steppe] = 'steppe'
des = (box(15, 33, -17, 35) | box(15, 31, 35, 60) | box(25, 36, 55, 71) | box(-31, -20, 118, 141)
       | box(27, 37, -118, -106) | box(37, 46, 76, 112) | box(-28, -17, 12, 24) | box(-27, -17, -71, -68))
biome[des] = 'desert'
biome[des & (N > 0.62)] = 'desert2'
gr = cid == (names.index('Greenland') + 1)
ant = (cid == (names.index('Antarctica') + 1)) | (LAT < -60)
biome[(la > 72) | gr | ant] = 'snow'
biome[((la > 72) | gr | ant) & (N > 0.6)] = 'snow2'
for k in ['rain', 'forest', 'grass', 'grass2', 'savanna', 'steppe', 'desert', 'desert2', 'boreal', 'tundra', 'snow', 'snow2']:
    m = land & (biome == k)
    img[m] = P[k]

# --- flat ice caps near the poles (the map is stretched there, so any texture turns into streaks) ---
img[LAT < -70] = P['snow']
img[(LAT > 84)] = P['ice_sea']

# --- light shading on land: a lighter top-left edge, darker bottom-right, for a bit of relief -------
up = np.roll(land, 1, 0) & np.roll(land, 1, 1)
edge_hi = land & ~np.roll(land, 1, 0) & (np.abs(LAT) < 80)
img[edge_hi] = np.minimum(255, img[edge_hi].astype(int) + 28).astype(np.uint8)
edge_lo = land & ~np.roll(land, -1, 0) & (np.abs(LAT) < 80)
img[edge_lo] = (img[edge_lo] * 0.78).astype(np.uint8)

# --- country borders: a 1px darker line where the country id changes --------------------------------
b = np.zeros((H, W), bool)
b[:, 1:] |= (cid[:, 1:] != cid[:, :-1]) & (cid[:, 1:] > 0) & (cid[:, :-1] > 0)
b[1:, :] |= (cid[1:, :] != cid[:-1, :]) & (cid[1:, :] > 0) & (cid[:-1, :] > 0)
b &= land
img[b] = (img[b] * 0.72).astype(np.uint8)

# --- coastline: a crisp dark pixel ring around the land --------------------------------------------
outline = np.zeros((H, W), bool)
for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
    outline |= np.roll(np.roll(land, dy, 0), dx, 1)
outline &= ~land
img[outline & ~((LAT > 80) | (LAT < -70))] = P['coast']

# --- dotted graticule over the water every 30 degrees ----------------------------------------------
grid = np.zeros((H, W), bool)
for g in range(-60, 61, 30):
    r = int((90 - g) / 180 * H); grid[r, ::4] = True
for g in range(-180, 180, 30):
    c = int((g + 180) / 360 * W); grid[::4, c] = True
gm = grid & ~d2 & (np.abs(LAT) < 78)
img[gm] = np.minimum(255, img[gm].astype(int) + 22).astype(np.uint8)

out = Image.fromarray(img).resize((W * 2, H * 2), Image.NEAREST)
out.save(OUT, optimize=True)
print('saved', OUT, out.size)
