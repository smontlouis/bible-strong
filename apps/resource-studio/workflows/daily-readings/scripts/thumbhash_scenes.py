"""Give every exported scene a ThumbHash of its background, written into build/scenes.json.

The application draws it at once behind a card whose scene is not loaded yet: the days of the home
carousel stacked behind today's load their picture only when they come in front (2026-11-26).
It is computed from the exported 768 px background, so the WebP files are never re-encoded.
Runs after export_scenes.py, with the same Python (Pillow with WebP).
"""
import base64, json, math
from PIL import Image
from paths import BUILD


def _round(x):
    # JavaScript's Math.round: halves go up, as the reference encoder does.
    return math.floor(x + 0.5)


def rgba_to_thumbhash(w, h, rgba):
    """Port of Evan Wallace's reference rgbaToThumbHash (https://evanw.github.io/thumbhash/)."""
    assert w <= 100 and h <= 100, (w, h)
    n = w * h
    avg_r = avg_g = avg_b = avg_a = 0.0
    for i in range(n):
        j = 4 * i
        alpha = rgba[j + 3] / 255
        avg_r += alpha / 255 * rgba[j]
        avg_g += alpha / 255 * rgba[j + 1]
        avg_b += alpha / 255 * rgba[j + 2]
        avg_a += alpha
    if avg_a:
        avg_r /= avg_a
        avg_g /= avg_a
        avg_b /= avg_a
    has_alpha = avg_a < n
    l_limit = 5 if has_alpha else 7
    lx = max(1, _round(l_limit * w / max(w, h)))
    ly = max(1, _round(l_limit * h / max(w, h)))
    l, p, q, a = [0.0] * n, [0.0] * n, [0.0] * n, [0.0] * n
    for i in range(n):
        j = 4 * i
        alpha = rgba[j + 3] / 255
        r = avg_r * (1 - alpha) + alpha / 255 * rgba[j]
        g = avg_g * (1 - alpha) + alpha / 255 * rgba[j + 1]
        b = avg_b * (1 - alpha) + alpha / 255 * rgba[j + 2]
        l[i] = (r + g + b) / 3
        p[i] = (r + g) / 2 - b
        q[i] = r - g
        a[i] = alpha

    def encode_channel(channel, nx, ny):
        dc, ac, scale = 0.0, [], 0.0
        for cy in range(ny):
            cx = 0
            while cx * ny < nx * (ny - cy):
                fx = [math.cos(math.pi / w * cx * (x + 0.5)) for x in range(w)]
                f = 0.0
                for y in range(h):
                    fy = math.cos(math.pi / h * cy * (y + 0.5))
                    row = y * w
                    for x in range(w):
                        f += channel[x + row] * fx[x] * fy
                f /= n
                if cx or cy:
                    ac.append(f)
                    scale = max(scale, abs(f))
                else:
                    dc = f
                cx += 1
        if scale:
            ac = [0.5 + 0.5 / scale * f for f in ac]
        return dc, ac, scale

    l_dc, l_ac, l_scale = encode_channel(l, max(3, lx), max(3, ly))
    p_dc, p_ac, p_scale = encode_channel(p, 3, 3)
    q_dc, q_ac, q_scale = encode_channel(q, 3, 3)
    if has_alpha:
        a_dc, a_ac, a_scale = encode_channel(a, 5, 5)
    is_landscape = w > h
    header24 = (_round(63 * l_dc) | (_round(31.5 + 31.5 * p_dc) << 6) | (_round(31.5 + 31.5 * q_dc) << 12)
                | (_round(31 * l_scale) << 18) | (int(has_alpha) << 23))
    header16 = ((ly if is_landscape else lx) | (_round(63 * p_scale) << 3) | (_round(63 * q_scale) << 9)
                | (int(is_landscape) << 15))
    out = [header24 & 255, (header24 >> 8) & 255, header24 >> 16, header16 & 255, header16 >> 8]
    ac_start = 6 if has_alpha else 5
    if has_alpha:
        out.append(_round(15 * a_dc) | (_round(15 * a_scale) << 4))
    index = 0
    for ac in ([l_ac, p_ac, q_ac, a_ac] if has_alpha else [l_ac, p_ac, q_ac]):
        for f in ac:
            at = ac_start + (index >> 1)
            while len(out) <= at:
                out.append(0)
            out[at] |= _round(15 * f) << ((index & 1) << 2)
            index += 1
    return bytes(out)


def scene_thumbhash(path):
    image = Image.open(path).convert('RGBA')
    image.thumbnail((100, 100), Image.LANCZOS)
    return base64.b64encode(rgba_to_thumbhash(image.width, image.height, image.tobytes())).decode()


if __name__ == '__main__':
    scenes = json.loads((BUILD / 'scenes.json').read_text())
    for sid, scene in scenes.items():
        scene['thumbhash'] = scene_thumbhash(BUILD / 'daily-scenes' / sid / scene['hash'] / 'bg-w768.webp')
    (BUILD / 'scenes.json').write_text(json.dumps(scenes, indent=1))
    print(len(scenes), 'thumbhashes,', max(len(s['thumbhash']) for s in scenes.values()), 'characters at most')
