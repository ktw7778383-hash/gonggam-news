#!/usr/bin/env node
// 共감 신문 데이터 검사기 — 저장소 맨 위 폴더에서 `node tools/validate.mjs` 로 실행해요.
// 문제가 있으면 무엇을 고쳐야 하는지 알려 주고 실패(종료 코드 1)로 끝나요.
import { readFileSync, existsSync } from "node:fs";

const ORDER = ["mon", "tue", "wed", "thu", "fri"];
const CORNERS = { mon: "사회·경제", tue: "과학·환경", wed: "디지털·미디어", thu: "역사·문화", fri: "생각 톺아보기" };
const SKILLS = ["사실 확인", "낱말", "추론", "적용", "중심 생각", "비판"];
const plain = s => s.replace(/\[\[(.+?)\]\]/g, "$1");
const len = s => plain(s).replace(/\s/g, "").length;

const errors = [], warns = [];
const err = (w, m) => errors.push(`✗ [${w}] ${m}`);
const warn = (w, m) => warns.push(`! [${w}] ${m}`);

let index;
try { index = JSON.parse(readFileSync("data/index.json", "utf8")); }
catch (e) { console.error("data/index.json을 읽을 수 없어요: " + e.message); process.exit(1); }
if (!Array.isArray(index.weeks) || !index.weeks.length) { console.error("data/index.json의 weeks가 비어 있어요"); process.exit(1); }

const titles = new Map();
const numbering = []; // 최신 주부터 [첫 호, 끝 호]

index.weeks.forEach((w, wi) => {
  const tag = w.week || `weeks[${wi}]`;
  if (!/^\d{4}-W\d{2}$/.test(w.week || "")) err(tag, "week는 2026-W47 같은 형식이어야 해요");
  if (index.weeks.findIndex(x => x.week === w.week) !== wi) err(tag, "같은 주가 index.json에 두 번 있어요");
  if (wi > 0 && !(index.weeks[wi - 1].start > w.start)) err(tag, "index.json의 weeks는 최신 주가 맨 앞에 오도록 정렬해야 해요");
  const sd = new Date((w.start || "") + "T00:00:00Z");
  if (isNaN(sd) || sd.getUTCDay() !== 1) err(tag, "start는 월요일 날짜(YYYY-MM-DD)여야 해요");
  if (!w.label) err(tag, "label이 없어요 (예: 11월 23일 ~ 27일)");
  if (w.file !== `data/${w.week}.json`) err(tag, `file은 data/${w.week}.json 이어야 해요`);
  if (!existsSync(w.file || "")) { err(tag, `${w.file} 파일이 없어요`); return; }

  let data;
  try { data = JSON.parse(readFileSync(w.file, "utf8")); }
  catch (e) { err(tag, "JSON 문법 오류: " + e.message); return; }
  if (data.week !== w.week) err(tag, "주 파일의 week 값이 index.json과 달라요");
  if (data.start !== w.start) err(tag, "주 파일의 start 값이 index.json과 달라요");
  if (data.label !== w.label) err(tag, "주 파일의 label 값이 index.json과 달라요");
  if (!Array.isArray(data.issues) || data.issues.length !== 5) { err(tag, "issues는 월~금 5개여야 해요"); return; }
  if (JSON.stringify(data.issues.map(i => i.title)) !== JSON.stringify(w.titles)) err(tag, "index.json의 titles가 주 파일의 제목 5개와 달라요");

  const mc = [];
  data.issues.forEach((iss, k) => {
    const t = `${tag}/${iss.id || k}`;
    if (iss.id !== ORDER[k]) err(t, `${k + 1}번째 글의 id는 ${ORDER[k]} 이어야 해요`);
    if (iss.corner !== CORNERS[ORDER[k]]) warn(t, `코너 이름이 기본값(${CORNERS[ORDER[k]]})과 달라요`);
    for (const f of ["title", "deck", "pre", "key", "echo"])
      if (typeof iss[f] !== "string" || !iss[f].trim()) err(t, `${f}가 비어 있어요`);
    if (!Number.isInteger(iss.no)) err(t, "no(호수)는 정수여야 해요");
    if (titles.has(iss.title)) err(t, `제목이 ${titles.get(iss.title)}와 겹쳐요`);
    titles.set(iss.title, t);

    const body = Array.isArray(iss.body) ? iss.body : [];
    if (body.some(b => typeof b.p !== "string" && typeof b.h !== "string")) err(t, "body 항목은 {\"h\":…} 또는 {\"p\":…} 이어야 해요");
    const paras = body.filter(b => typeof b.p === "string");
    if (paras.length < 5 || paras.length > 7) err(t, `문단이 ${paras.length}개예요 (5~7개)`);
    const chars = paras.reduce((n, b) => n + len(b.p), 0);
    if (chars < 550 || chars > 1000) err(t, `본문이 공백 빼고 ${chars}자예요 (550~1000자)`);
    paras.forEach((b, pi) => { if (len(b.p) > 260) warn(t, `${pi + 1}문단이 ${len(b.p)}자로 길어요`); });

    const marked = new Set();
    paras.forEach(b => { for (const m of b.p.matchAll(/\[\[(.+?)\]\]/g)) marked.add(m[1]); });
    const terms = iss.terms && typeof iss.terms === "object" ? iss.terms : {};
    const keys = Object.keys(terms);
    if (keys.length < 4 || keys.length > 6) err(t, `낱말이 ${keys.length}개예요 (4~6개)`);
    keys.forEach(k => {
      if (!marked.has(k)) err(t, `낱말 '${k}'를 본문에 [[${k}]]로 표시해 주세요`);
      const v = terms[k], d = v && typeof v === "object" ? v.d : v;
      if (typeof d !== "string" || !d.trim()) err(t, `낱말 '${k}'의 뜻이 비어 있어요`);
    });
    marked.forEach(k => { if (!(k in terms)) err(t, `[[${k}]]의 뜻이 terms에 없어요`); });

    const quiz = Array.isArray(iss.quiz) ? iss.quiz : [];
    if (quiz.length !== 6) err(t, `문제가 ${quiz.length}개예요 (6개)`);
    const types = { mc: 0, ox: 0, blank: 0 }, skills = new Set();
    quiz.forEach((q, qi) => {
      const qt = `${t} 문제${qi + 1}`;
      if (!(q.type in types)) { err(qt, "type은 mc, ox, blank 중 하나예요"); return; }
      types[q.type]++;
      if (!SKILLS.includes(q.skill)) err(qt, `skill은 ${SKILLS.join(", ")} 중 하나예요`); else skills.add(q.skill);
      if (typeof q.q !== "string" || !q.q.trim()) err(qt, "q(문제)가 비어 있어요");
      if (typeof q.why !== "string" || !q.why.trim()) err(qt, "why(해설)가 비어 있어요");
      if (q.ev !== null && !(Number.isInteger(q.ev) && q.ev >= 1 && q.ev <= paras.length)) err(qt, `ev는 1~${paras.length} 사이 문단 번호이거나 null이어야 해요`);
      if (q.type === "mc") {
        if (!Array.isArray(q.options) || q.options.length !== 4) err(qt, "보기는 4개여야 해요");
        else if (new Set(q.options).size !== 4) err(qt, "보기가 서로 겹쳐요");
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(qt, "answer는 0~3(①~④)이어야 해요");
        else mc.push(q.answer);
      }
      if (q.type === "ox" && typeof q.answer !== "boolean") err(qt, "O·X 문제의 answer는 true(O) 또는 false(X)예요");
      if (q.type === "blank") {
        if (((q.q || "").match(/___/g) || []).length !== 1) err(qt, "빈칸 ___는 문제에 정확히 한 번 있어야 해요");
        if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some(a => typeof a !== "string" || !a.trim())) err(qt, "빈칸 문제의 answer는 인정할 답 목록이에요");
      }
    });
    if (types.mc < 3 || types.ox < 1 || types.blank < 1)
      err(t, `문제 유형: 4지선다 ${types.mc}개, O·X ${types.ox}개, 빈칸 ${types.blank}개 (4지선다 3개 이상, O·X·빈칸 1개 이상)`);
    if (skills.size < 4) err(t, `문제 영역이 ${skills.size}가지예요 (4가지 이상)`);

    if (!Array.isArray(iss.sources) || !iss.sources.length) err(t, "sources(참고한 자료)가 1개 이상 있어야 해요");
    else iss.sources.forEach(s => { if (!s || !s.title || !/^https:\/\//.test(s.url || "")) err(t, "sources 항목은 {\"title\":…, \"url\":\"https://…\"} 형식이에요"); });
  });

  data.issues.forEach((iss, k) => { if (iss.no !== data.issues[0].no + k) err(`${tag}/${iss.id}`, "호수(no)는 월요일부터 1씩 늘어나야 해요"); });
  numbering.push([data.issues[0].no, data.issues[4].no, tag]);

  if (mc.length) {
    const cnt = [0, 0, 0, 0]; mc.forEach(a => cnt[a]++);
    const show = cnt.map((c, i) => "①②③④"[i] + c).join(" ");
    if (Math.max(...cnt) / mc.length > 0.4) err(tag, `4지선다 정답이 한 번호에 몰렸어요 (${show})`);
    if (cnt.filter(Boolean).length < 3) err(tag, `정답 번호를 더 고르게 섞어 주세요 (${show})`);
  }
});

for (let i = 0; i < numbering.length - 1; i++) {
  const [newFirst, , tag] = numbering[i], [, oldLast] = numbering[i + 1];
  if (newFirst !== oldLast + 1) err(tag, `호수가 이어지지 않아요 (지난주 마지막 ${oldLast}호 → 이번 주 첫 호는 ${oldLast + 1}호)`);
}

warns.forEach(m => console.log(m));
if (errors.length) { errors.forEach(m => console.log(m)); console.log(`\n검사 실패: 고칠 곳 ${errors.length}개`); process.exit(1); }
console.log(`검사 통과: ${index.weeks.length}주, 글 ${index.weeks.length * 5}편` + (warns.length ? ` (참고 ${warns.length}개)` : ""));
