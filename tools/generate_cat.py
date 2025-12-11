import os
import struct
import zlib

WIDTH = 32
HEIGHT = 32

COLOR = {
    "clear": (0, 0, 0, 0),
    "shadow": (0, 0, 0, 70),
    "fur": (118, 116, 125, 255),
    "fur_dark": (84, 83, 90, 255),
    "belly": (164, 162, 173, 255),
    "eye": (242, 201, 76, 255),
    "pupil": (54, 49, 35, 255),
    "nose": (226, 146, 146, 255),
}


def blank():
    return [[COLOR["clear"] for _ in range(WIDTH)] for _ in range(HEIGHT)]


def set_pixel(img, x, y, color):
    if 0 <= x < WIDTH and 0 <= y < HEIGHT:
        img[y][x] = color


def fill_rect(img, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            set_pixel(img, x, y, color)


def clone(img):
    return [row[:] for row in img]


def draw_base():
    img = blank()

    # Ground shadow
    for x in range(6, 26):
        set_pixel(img, x, 28, COLOR["shadow"])
        set_pixel(img, x, 29, COLOR["shadow"])

    # Tail
    fill_rect(img, 22, 18, 26, 22, COLOR["fur"])
    fill_rect(img, 24, 20, 26, 22, COLOR["belly"])
    set_pixel(img, 26, 17, COLOR["fur_dark"])
    set_pixel(img, 25, 17, COLOR["fur_dark"])

    # Body
    fill_rect(img, 8, 18, 23, 25, COLOR["fur"])
    fill_rect(img, 12, 20, 19, 24, COLOR["belly"])

    # Body outline
    for x in range(8, 24):
        set_pixel(img, x, 18, COLOR["fur_dark"])
        set_pixel(img, x, 25, COLOR["fur_dark"])
    for y in range(18, 26):
        set_pixel(img, 8, y, COLOR["fur_dark"])
        set_pixel(img, 23, y, COLOR["fur_dark"])

    # Paws
    fill_rect(img, 11, 25, 13, 26, COLOR["fur_dark"])
    fill_rect(img, 18, 25, 20, 26, COLOR["fur_dark"])

    # Head
    fill_rect(img, 10, 9, 21, 17, COLOR["fur"])
    for x in range(10, 22):
        set_pixel(img, x, 9, COLOR["fur_dark"])
        set_pixel(img, x, 17, COLOR["fur_dark"])
    for y in range(9, 18):
        set_pixel(img, 10, y, COLOR["fur_dark"])
        set_pixel(img, 21, y, COLOR["fur_dark"])

    # Ears
    fill_rect(img, 10, 7, 12, 9, COLOR["fur_dark"])
    fill_rect(img, 19, 7, 21, 9, COLOR["fur_dark"])
    set_pixel(img, 11, 7, COLOR["fur"])
    set_pixel(img, 20, 7, COLOR["fur"])

    # Face
    set_pixel(img, 13, 13, COLOR["eye"])
    set_pixel(img, 18, 13, COLOR["eye"])
    set_pixel(img, 13, 14, COLOR["pupil"])
    set_pixel(img, 18, 14, COLOR["pupil"])
    set_pixel(img, 15, 15, COLOR["nose"])
    set_pixel(img, 14, 16, COLOR["fur_dark"])
    set_pixel(img, 16, 16, COLOR["fur_dark"])
    set_pixel(img, 15, 17, COLOR["fur_dark"])

    # Cheeks
    set_pixel(img, 12, 15, COLOR["belly"])
    set_pixel(img, 19, 15, COLOR["belly"])

    return img


def make_walk_frame(base):
    walk = clone(base)
    # lift front paw
    fill_rect(walk, 18, 24, 20, 25, COLOR["fur_dark"])
    fill_rect(walk, 18, 26, 20, 26, COLOR["clear"])
    # move tail up
    set_pixel(walk, 23, 17, COLOR["fur"])
    set_pixel(walk, 24, 17, COLOR["belly"])
    return walk


def make_sleep_frame(base):
    sleep = clone(base)
    # lower head slightly
    for y in range(17, 26):
        for x in range(10, 22):
            sleep[y][x] = sleep[y - 1][x]
    # eyes closed
    set_pixel(sleep, 13, 14, COLOR["fur_dark"])
    set_pixel(sleep, 18, 14, COLOR["fur_dark"])
    set_pixel(sleep, 13, 13, COLOR["clear"])
    set_pixel(sleep, 18, 13, COLOR["clear"])
    # calm tail
    fill_rect(sleep, 22, 18, 26, 22, COLOR["fur"])
    fill_rect(sleep, 24, 20, 26, 22, COLOR["belly"])
    return sleep


def write_png(path, pixels):
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBBB", *px) for px in row) for row in pixels
    )

    def chunk(chunk_type, data):
        return (
            struct.pack(">I", len(data))
            + chunk_type
            + data
            + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        )

    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    png_bytes = b"\x89PNG\r\n\x1a\n" + ihdr + idat + iend

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png_bytes)


def main():
    base = draw_base()
    walk = make_walk_frame(base)
    sleep = make_sleep_frame(base)
    write_png(os.path.join("assets", "cat_idle.png"), base)
    write_png(os.path.join("assets", "cat_walk.png"), walk)
    write_png(os.path.join("assets", "cat_sleep.png"), sleep)
    print("Generated cat frames in ./assets")


if __name__ == "__main__":
    main()
