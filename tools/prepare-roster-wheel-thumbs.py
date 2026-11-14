"""Build 2x roster wheel thumbnails: python tools/prepare-roster-wheel-thumbs.py."""
import json
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
items = json.loads((root / "data/wheel_list.json").read_text(encoding="utf-8"))
output = root / "images/client_art/wheel_thumb"
output.mkdir(parents=True, exist_ok=True)
for item in items:
    source = root / item["image_path"]
    with Image.open(source) as image:
        image.thumbnail((216, 1000), Image.Resampling.LANCZOS)
        image.save(output / source.name, format="WEBP", quality=88, method=6)
print(f"Prepared {len(items)} wheel thumbnails")
