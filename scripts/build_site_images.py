from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "images"
TIMELINE = ROOT / "ai-ml-timeline.png"
CROPS = (
    ("timeline-work-wide.webp", (0, 1400, 3200, 3200), (1600, 900), 86),
    ("timeline-poster.webp", None, (1000, 1500), 88),
)


def save_webp(image: Image.Image, destination: Path, size: tuple[int, int], quality: int) -> None:
    ImageOps.fit(image, size, Image.Resampling.LANCZOS).save(destination, "WEBP", quality=quality, method=6)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(TIMELINE) as opened:
        source = ImageOps.exif_transpose(opened).convert("RGB")
        for filename, crop, size, quality in CROPS:
            destination = OUTPUT / filename
            save_webp(source if crop is None else source.crop(crop), destination, size, quality)
            print(f"Built {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

