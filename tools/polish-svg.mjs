#!/usr/bin/env node
// 그림 다듬기 — 저장소 맨 위 폴더에서 `node tools/polish-svg.mjs` 로 실행해요.
// img/*.svg 그림에 은은한 그러데이션 배경, 빛 번짐, 종이 질감(점무늬), 그림자를 더해 입체감을 줘요.
// 이미 다듬은 그림(data-polished)은 건너뛰니 여러 번 실행해도 괜찮아요.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const hex = h => h.replace("#", "").match(/../g).map(x => parseInt(x, 16));
const toHex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (c, t, k) => toHex(hex(c).map((v, i) => v + (hex(t)[i] - v) * k));

let n = 0;
for (const f of readdirSync("img").filter(f => f.endsWith(".svg"))) {
  const path = "img/" + f;
  let s = readFileSync(path, "utf8");
  if (s.includes("data-polished")) continue;
  const bg = s.match(/<rect width="640" height="360" fill="(#[0-9A-Fa-f]{6})"\s*\/>/);
  const base = bg ? bg[1] : "#F2F3EE";
  const defs =
    `<defs>` +
    `<linearGradient id="pbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(base, "#FFFFFF", 0.45)}"/><stop offset="1" stop-color="${mix(base, "#15212C", 0.07)}"/></linearGradient>` +
    `<radialGradient id="pglow" cx="0.3" cy="0.22" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>` +
    `<pattern id="pdot" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".9" fill="#15212C" opacity=".07"/></pattern>` +
    `<filter id="psh" x="-5%" y="-5%" width="115%" height="120%"><feDropShadow dx="3" dy="4" stdDeviation="0" flood-color="#15212C" flood-opacity=".18"/></filter>` +
    `<radialGradient id="pvig" cx="0.5" cy="0.5" r="0.75"><stop offset=".7" stop-color="#15212C" stop-opacity="0"/><stop offset="1" stop-color="#15212C" stop-opacity=".12"/></radialGradient>` +
    `</defs>`;
  const back = `<rect width="640" height="360" fill="url(#pbg)"/><rect width="640" height="360" fill="url(#pglow)"/>`;
  const front = `<rect width="640" height="360" fill="url(#pdot)" pointer-events="none"/><rect width="640" height="360" fill="url(#pvig)" pointer-events="none"/>`;
  if (bg) s = s.replace(bg[0], defs + back + "<g filter=\"url(#psh)\">");
  else s = s.replace(/(<svg[^>]*>(?:<title>.*?<\/title>)?)/, "$1" + defs + back + "<g filter=\"url(#psh)\">");
  s = s.replace(/<\/svg>\s*$/, "</g>" + front + "</svg>\n").replace("<svg ", "<svg data-polished=\"1\" ");
  writeFileSync(path, s);
  n++;
}
console.log(`그림 ${n}장을 다듬었어요.`);
