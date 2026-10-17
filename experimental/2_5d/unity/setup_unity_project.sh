#!/usr/bin/env bash
# Copia scripts, sprites ORIGINAIS e a cena exportada para um projeto Unity
# criado pelo modelo "2D (URP)" (Unity 2022.3 LTS), e gera os normal maps.
#
#   bash experimental/2_5d/unity/setup_unity_project.sh <raiz-do-repo> <pasta-do-projeto-unity>
#
# Depende de python3 com numpy e Pillow. Nao toca em nada fora de
# <projeto>/Assets/Miguelito25D.
set -euo pipefail
REPO="$(cd "$1" && pwd)"
PROJECT="$2"
SRC="$REPO/experimental/2_5d/unity/Miguelito25D/Assets/Miguelito25D"
DEST="$PROJECT/Assets/Miguelito25D"
ART="$DEST/Resources/Art"
NORMALS="python3 $REPO/experimental/2_5d/tools/generate_normals.py"

[ -d "$PROJECT/Assets" ] || { echo "Projeto Unity nao encontrado em $PROJECT"; exit 1; }
mkdir -p "$DEST" "$ART"/{miguelito,organisms,bacillus,backgrounds,terrain}
cp -r "$SRC/Runtime" "$SRC/Editor" "$DEST/"

for f in run idle hurt celebrate; do cp "$REPO/assets/miguelito/$f.png" "$ART/miguelito/"; done
for f in "$REPO"/assets/organisms/*.png; do
  case "$(basename "$f")" in pseudomonas-original.png) continue;; esac
  cp "$f" "$ART/organisms/"
done
cp "$REPO/assets/bacillus/bacillus.png" "$ART/bacillus/"
cp "$REPO/assets/backgrounds/miguelito-rhizosphere.png" "$ART/backgrounds/"

SCENE="$REPO/experimental/2_5d/unity/scene-export/fase4"
cp "$SCENE/level.json" "$DEST/Resources/level.json"
cp "$SCENE"/terrain_*.png "$ART/terrain/"

# normal maps na convencao da Unity (verde para cima), mesma medida da folha
for dir in miguelito organisms bacillus terrain; do
  for f in "$ART/$dir"/*.png; do
    case "$f" in *_n.png) continue;; esac
    out="${f%.png}_n.png"
    $NORMALS "$f" "$out.tmp.png" && python3 - "$out.tmp.png" "$out" "$f" <<'PY'
import sys
from PIL import Image
tmp, out, src = sys.argv[1:4]
im = Image.open(tmp).convert('RGBA')
r, g, b, a = im.split()
g = g.point(lambda v: 255 - v)              # verde para cima (OpenGL/Unity)
im = Image.merge('RGBA', (r, g, b, Image.new('L', im.size, 255)))
size = Image.open(src).size
if im.size != size: im = im.resize(size, Image.BILINEAR)
im.save(out)
PY
    rm -f "$out.tmp.png"
  done
done
echo "Pronto: abra o projeto na Unity. A cena Assets/Miguelito25D/Scenes/Rizosfera25D.unity e montada sozinha."
