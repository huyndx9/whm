// 앱 아이콘을 코드로 그린다. 디자인 도구 없이도 다시 만들 수 있게 하려는 것.
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const BRAND = [15, 76, 92]; // #0F4C5C
const WHITE = [255, 255, 255];
const ACCENT = [255, 107, 53]; // #FF6B35

const OUT_DIR = path.join(process.cwd(), "public");

function draw(size, { maskable }) {
  const png = new PNG({ width: size, height: size });
  // maskable 아이콘은 원형으로 잘려도 되도록 여백을 크게 준다
  const pad = maskable ? size * 0.22 : size * 0.14;
  const radius = maskable ? 0 : size * 0.22;

  const set = (x, y, [r, g, b], a = 255) => {
    const i = (size * y + x) << 2;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  };

  const inRoundedRect = (x, y, left, top, right, bottom, rad) => {
    if (x < left || x > right || y < top || y > bottom) return false;
    const cx = Math.min(Math.max(x, left + rad), right - rad);
    const cy = Math.min(Math.max(y, top + rad), bottom - rad);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2 + rad;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 배경
      if (maskable || inRoundedRect(x, y, 0, 0, size - 1, size - 1, radius)) {
        set(x, y, BRAND);
      } else {
        set(x, y, [0, 0, 0], 0);
      }
    }
  }

  // 가운데에 상자(재고) 모양을 그린다
  const bx0 = Math.round(pad);
  const bx1 = Math.round(size - pad);
  const boxTop = Math.round(pad + (bx1 - bx0) * 0.16);
  const boxBottom = Math.round(size - pad);
  const lid = Math.round(boxTop + (boxBottom - boxTop) * 0.26);
  const stroke = Math.max(2, Math.round(size * 0.035));

  const fillRect = (x0, y0, x1, y1, color) => {
    for (let y = Math.max(0, y0); y <= Math.min(size - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(size - 1, x1); x++) set(x, y, color);
    }
  };

  // 상자 본체 외곽선
  fillRect(bx0, boxTop, bx1, boxTop + stroke, WHITE);
  fillRect(bx0, boxBottom - stroke, bx1, boxBottom, WHITE);
  fillRect(bx0, boxTop, bx0 + stroke, boxBottom, WHITE);
  fillRect(bx1 - stroke, boxTop, bx1, boxBottom, WHITE);
  // 뚜껑 선
  fillRect(bx0, lid, bx1, lid + stroke, WHITE);
  // 손잡이(포인트 색)
  const hw = Math.round((bx1 - bx0) * 0.18);
  const hcx = Math.round((bx0 + bx1) / 2);
  fillRect(hcx - hw, lid + stroke * 2, hcx + hw, lid + stroke * 2 + stroke, ACCENT);

  return PNG.sync.write(png);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, { maskable: false }],
  ["icon-512.png", 512, { maskable: false }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }],
];

for (const [name, size, opts] of targets) {
  fs.writeFileSync(path.join(OUT_DIR, name), draw(size, opts));
  console.log("wrote", name, `${size}x${size}`);
}
