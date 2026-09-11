// README 용 화면 캡처. 설치된 Chrome 을 그대로 써서 데모 데이터 상태의 각 화면을 찍는다.
//   npm run dev 가 켜져 있어야 한다.   사용:  node scripts/screenshots.mjs
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.APP_URL ?? "http://localhost:5178";
const OUT = path.join(process.cwd(), "docs", "screenshots");
const CHROME =
  process.env.CHROME_PATH ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) =>
    fs.existsSync(p),
  );

if (!CHROME) {
  console.error("Chrome/Edge 를 찾지 못했습니다. CHROME_PATH 환경변수로 지정하세요.");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 사이드바 메뉴를 라벨 앞부분으로 찾아 누른다 (배지 숫자가 붙어 있을 수 있음) */
async function goNav(page, label) {
  await page.evaluate((l) => {
    const btn = [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim().startsWith(l));
    if (!btn) throw new Error(`nav not found: ${l}`);
    btn.click();
  }, label);
  await sleep(600);
}

/** 본문(main) 안의 버튼을 정확한 라벨로 누른다 */
async function clickMain(page, label) {
  await page.evaluate((l) => {
    const btn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === l);
    if (!btn) throw new Error(`button not found: ${l}`);
    btn.click();
  }, label);
  await sleep(500);
}

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: opts.fullPage ?? false });
  console.log("saved", path.relative(process.cwd(), file));
}

/** 데모 영수증을 넣어 인식 결과 화면까지 진행 */
async function runDemoScan(page) {
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 600, 400);
    x.fillStyle = "#111";
    x.font = "16px sans-serif";
    x.fillText("부산수산 거래명세서", 30, 40);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const input = [...document.querySelectorAll('input[type=file]')].find((i) => !i.hasAttribute("capture"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await sleep(700);
  await clickMain(page, "인식 시작");
  await sleep(2600);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--lang=ko-KR", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });
  page.on("dialog", (d) => d.accept());

  await page.goto(BASE, { waitUntil: "networkidle0" });
  // 항상 같은 데모 데이터로 찍히도록 초기화
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("taekine-inventory"))
      .forEach((k) => localStorage.removeItem(k));
  });
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(1200);

  // 1. 대시보드
  await shot(page, "01-dashboard");

  // 2. 판매 등록
  await goNav(page, "판매 등록");
  await shot(page, "02-sales");

  // 3. 재고 관리
  await goNav(page, "재고 관리");
  await shot(page, "03-inventory");

  // 4. 입출고 관리 > 영수증 스캔 인식 결과
  await goNav(page, "입출고 관리");
  await clickMain(page, "영수증 스캔");
  await runDemoScan(page);
  await shot(page, "04-scan-review");

  // 5. 일일 마감 - 몇 줄 입력해 차이가 보이게
  await goNav(page, "일일 마감");
  await page.evaluate(() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set;
      s.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const rows = [...document.querySelectorAll("tbody tr")];
    const pick = (name, delta) => {
      const r = rows.find((x) => x.innerText.startsWith(name));
      if (!r) return;
      const book = Number(r.querySelector("input").placeholder);
      set(r.querySelector("input"), String(Number((book + delta).toFixed(1))));
    };
    pick("바지락", -1.5);
    pick("모시조개", -0.8);
    pick("대파", 0.5);
  });
  await sleep(500);
  await shot(page, "05-shift-close");

  // 6. 발주 관리 - 요일 기준
  await goNav(page, "발주 관리");
  await clickMain(page, "요일 기준");
  await sleep(500);
  await shot(page, "06-orders-weekday");

  // 7. 발주서 미리보기
  await clickMain(page, "발주서 만들기");
  await sleep(1200);
  await shot(page, "07-purchase-order");
  // 모달 닫기
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const close = document.querySelector('button[aria-label="닫기"]');
    if (close) close.click();
  });
  await sleep(400);

  // 8. 수요 예측
  await goNav(page, "수요 예측");
  await shot(page, "08-forecast");

  // 9. 설정 > 메뉴·레시피
  await goNav(page, "설정");
  await sleep(400);
  await shot(page, "09-menu-recipes");

  // 10. 모바일 - 판매 등록
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(1000);
  await page.evaluate(() => document.querySelector("header button").click());
  await sleep(400);
  await goNav(page, "판매 등록");
  await sleep(500);
  await shot(page, "10-mobile-sales");

  // 11. 모바일 - 대시보드
  await page.evaluate(() => document.querySelector("header button").click());
  await sleep(400);
  await goNav(page, "대시보드");
  await sleep(600);
  await shot(page, "11-mobile-dashboard");

  console.log("done");
} finally {
  await browser.close();
}
