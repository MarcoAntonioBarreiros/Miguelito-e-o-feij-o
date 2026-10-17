#!/usr/bin/env python3
"""Gera normal maps a partir das folhas de sprite ORIGINAIS (mesmo algoritmo
de gl/sprite-normals.js), para uso fora do navegador — na Unity, por exemplo,
como textura secundaria `_NormalMap` de cada sprite.

Nada e redesenhado: o relevo sai do alfa (volume) e da luminancia (detalhe)
da propria arte. O alfa original e preservado no canal A.

Uso:
    python3 generate_normals.py <entrada.png> <saida_n.png> [volume] [detalhe]
    python3 generate_normals.py --all <pasta_assets> <pasta_saida>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MAX_WIDTH = 4096


def box_blur(a, r):
    """Box blur separavel por soma cumulativa (borda replicada)."""
    if r < 1:
        return a
    k = 2 * r + 1
    p = np.pad(a, ((0, 0), (r + 1, r)), mode='edge')
    c = np.cumsum(p, axis=1)
    a = (c[:, k:] - c[:, :-k]) / k
    p = np.pad(a, ((r + 1, r), (0, 0)), mode='edge')
    c = np.cumsum(p, axis=0)
    return (c[k:, :] - c[:-k, :]) / k


def blur3(a, r):
    return box_blur(box_blur(box_blur(a, r), r), r)


def normal_map(img, volume=1.0, detail=0.35):
    img = img.convert('RGBA')
    w, h = img.size
    scale = min(1.0, MAX_WIDTH / w)
    if scale < 1:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    d = np.asarray(img).astype(np.float32) / 255.0
    h = d.shape[0]
    alpha = d[..., 3]
    lum = (d[..., 0] * .2126 + d[..., 1] * .7152 + d[..., 2] * .0722) * alpha

    r_volume = max(2, round(h * .028))
    dome = blur3(alpha, r_volume)
    lum_soft = blur3(lum, max(1, round(h * .006)))
    lum_base = blur3(lum, max(2, round(h * .02)))
    height = np.sqrt(np.clip(dome, 0, None)) * volume + (lum_soft - lum_base) * detail

    gain = r_volume * 2.2
    gx = np.zeros_like(height)
    gy = np.zeros_like(height)
    gx[:, 1:-1] = (height[:, 2:] - height[:, :-2]) * .5
    gy[1:-1, :] = (height[2:, :] - height[:-2, :]) * .5
    nx = -gx * gain
    ny = -gy * gain  # espaco da imagem: v cresce para baixo
    nz = np.ones_like(height)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / ln, ny / ln, nz / ln
    return nx, ny, nz, alpha


def encode(nx, ny, nz, alpha, flip_green=False):
    """flip_green=True gera convencao OpenGL/Unity (y para cima)."""
    if flip_green:
        ny = -ny
    rgb = np.stack([nx, ny, nz], axis=-1) * .5 + .5
    out = np.concatenate([rgb, alpha[..., None]], axis=-1)
    return Image.fromarray(np.clip(out * 255 + .5, 0, 255).astype(np.uint8), 'RGBA')


def main(argv):
    if len(argv) >= 3 and argv[0] == '--all':
        src, dst = Path(argv[1]), Path(argv[2])
        flip = '--unity' in argv
        for f in sorted(src.rglob('*.png')):
            if f.stem.endswith('_n') or 'ui' in f.parts or 'backgrounds' in f.parts:
                continue
            out = dst / f.relative_to(src).with_name(f.stem + '_n.png')
            out.parent.mkdir(parents=True, exist_ok=True)
            img = Image.open(f)
            nm = encode(*normal_map(img), flip_green=flip)
            if nm.size != img.size:  # Unity pede a mesma medida da principal
                nm = nm.resize(img.size, Image.BILINEAR)
            nm.save(out)
            print(out)
        return
    src, dst = argv[0], argv[1]
    volume = float(argv[2]) if len(argv) > 2 else 1.0
    detail = float(argv[3]) if len(argv) > 3 else .35
    encode(*normal_map(Image.open(src), volume, detail)).save(dst)


if __name__ == '__main__':
    main(sys.argv[1:])
