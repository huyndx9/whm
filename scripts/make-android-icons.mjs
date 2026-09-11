// Capacitor 안드로이드 프로젝트의 런처 아이콘을 교체한다.
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const src = PNG.sync.read(fs.readFileSync("public/icon-512.png"));
const maskable = PNG.sync.read(fs.readFileSync("public/icon-maskable-512.png"));

// 단순 최근접 축소. 아이콘이 기하학적 도형이라 이 정도로 충분하다.
function resize(source, size) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x * source.width) / size);
      const sy = Math.floor((y * source.height) / size);
      const si = (source.width * sy + sx) << 2;
      const di = (size * y + x) << 2;
      out.data[di] = source.data[si];
      out.data[di + 1] = source.data[si + 1];
      out.data[di + 2] = source.data[si + 2];
      out.data[di + 3] = source.data[si + 3];
    }
  }
  return PNG.sync.write(out);
}

const densities = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

let count = 0;
for (const [density, size] of densities) {
  const dir = path.join("android/app/src/main/res", `mipmap-${density}`);
  if (!fs.existsSync(dir)) continue;
  fs.writeFileSync(path.join(dir, "ic_launcher.png"), resize(src, size));
  fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), resize(src, size));
  fs.writeFileSync(path.join(dir, "ic_launcher_foreground.png"), resize(maskable, size * 2));
  count += 3;
}
console.log("replaced", count, "launcher icons");
