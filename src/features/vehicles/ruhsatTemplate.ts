/**
 * Yeni tip (2017 sonrası) Araç Tescil Belgesi'nin sabit kutu düzeni — kullanıcı
 * isteği, 2026-10-22: "ruhsatta ne yazıyorsa detaylı baksın, yanlış yazmasın,
 * hepsini doğru girsin".
 *
 * Ruhsattaki etiketler (A) PLAKA, (E) ŞASE NO… her belgede aynı yerde basılı.
 * Fotoğrafta okunan etiketlerden şablon → fotoğraf dönüşümü (sayfa başına
 * afin: kayma, ölçek, hafif eğiklik) hesaplanır, sonra her kutunun SADECE değer
 * kısmı ayrı kesilip birkaç bulanıklıkta okunur. Nokta vuruşlu yazıcı yazısı
 * hafif bulanıklaştırınca harfler birleşip çok daha doğru okunuyor; etiketle
 * aynı karede okununca karışan değerler (yakıt cinsi gibi) de böyle ayrılıyor.
 *
 * Koordinatlar referans bir fotoğraftaki (1500 px genişlik ölçeğinde) yerlerdir;
 * birimin önemi yok, dönüşüm etiketlerden hesaplanır.
 */
import { trFold } from "@/lib/detectProvince";

export interface PlacedText {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Page = "L" | "R";
interface Anchor {
  page: Page;
  re: RegExp;
  x: number;
  y: number;
  not?: RegExp;
}

/** Etiketin sol üst köşesi. Eşleştirme Türkçe karaktersiz büyük harf metinde yapılır. */
const ANCHORS: Anchor[] = [
  { page: "L", re: /PLAKA/, x: 93, y: 852 },
  { page: "L", re: /ILK\s*TESC/, x: 387, y: 855 },
  { page: "L", re: /SIRA\s*N/, x: 93, y: 916 },
  { page: "L", re: /MARKAS/, x: 93, y: 980 },
  { page: "L", re: /TICARI\s*AD/, x: 91, y: 1036 },
  { page: "L", re: /MODEL\s*YIL/, x: 385, y: 1047 },
  { page: "L", re: /ARAC\W*SINIF/, x: 565, y: 1051 },
  { page: "L", re: /\bRENG/, x: 384, y: 1112 },
  { page: "L", re: /MOTOR\s*NO/, x: 90, y: 1169 },
  { page: "L", re: /SASE\s*N/, x: 90, y: 1232 },
  { page: "L", re: /NET\s*AG/, x: 88, y: 1291 },
  { page: "L", re: /AZAMI\s*YUKL/, x: 380, y: 1299, not: /ROMORK/ },
  { page: "L", re: /KATAR/, x: 86, y: 1348 },
  { page: "L", re: /ROMORK/, x: 377, y: 1362 },
  { page: "L", re: /KOLTUK|SUR\W*DAHIL/, x: 86, y: 1414 },
  { page: "L", re: /AYAKTA/, x: 378, y: 1428 },
  { page: "L", re: /SILIND/, x: 86, y: 1475 },
  { page: "L", re: /MOTOR\s*G/, x: 376, y: 1486 },
  { page: "L", re: /AGIRLIK\s*ORAN|MOTOSIKLET/, x: 376, y: 1555 },
  { page: "L", re: /KULLANIM/, x: 80, y: 1604 },
  { page: "L", re: /TIP\s*ONAY/, x: 371, y: 1617 },
  { page: "R", re: /KIML|T\.C\./, x: 771, y: 801 },
  { page: "R", re: /SOYAD/, x: 770, y: 865 },
  { page: "R", re: /UNVAN/, x: 771, y: 885 },
  { page: "R", re: /C\.1\.2/, x: 770, y: 930 },
  { page: "R", re: /ADRES/, x: 768, y: 996 },
  { page: "R", re: /UZERINDE/, x: 767, y: 1118 },
  { page: "R", re: /SATIS\s*TAR/, x: 1069, y: 1120 },
  { page: "R", re: /MENFAAT|BULUNANLAR/, x: 768, y: 1143 },
  { page: "R", re: /SATIS\s*NO/, x: 1067, y: 1180 },
  { page: "R", re: /NOTERIN/, x: 1066, y: 1239 },
  { page: "R", re: /DIGER/, x: 763, y: 1369 },
  { page: "R", re: /BELGE/, x: 1056, y: 1612 },
];

/** Değer kutuları (etiket hariç) — [sayfa, x0, y0, x1, y1]. */
export const TEMPLATE_CELLS: Record<
  string,
  [Page, number, number, number, number]
> = {
  issued_place: ["L", 95, 805, 715, 850],
  plate_number: ["L", 95, 870, 380, 913],
  first_registration_date: ["L", 385, 876, 712, 916],
  registration_sequence_no: ["L", 95, 937, 380, 976],
  registration_date: ["L", 385, 942, 712, 981],
  brand: ["L", 95, 1000, 380, 1036],
  model_type: ["L", 385, 1003, 712, 1041],
  commercial_name: ["L", 76, 1058, 380, 1096],
  year: ["L", 385, 1068, 560, 1103],
  vehicle_class: ["L", 565, 1071, 712, 1105],
  vehicle_type: ["L", 80, 1097, 380, 1167],
  color: ["L", 385, 1130, 712, 1168],
  engine_number: ["L", 88, 1187, 712, 1229],
  chassis_number: ["L", 88, 1249, 712, 1293],
  net_weight: ["L", 90, 1311, 330, 1346],
  max_laden_weight: ["L", 380, 1318, 668, 1353],
  train_weight: ["L", 90, 1371, 330, 1407],
  trailer_max_weight: ["L", 480, 1384, 668, 1421],
  seat_count: ["L", 90, 1432, 370, 1466],
  standing_capacity: ["L", 380, 1447, 712, 1483],
  engine_capacity: ["L", 90, 1494, 330, 1531],
  engine_power: ["L", 380, 1507, 668, 1546],
  fuel_type: ["L", 105, 1554, 255, 1592],
  power_weight_ratio: ["L", 380, 1572, 668, 1606],
  usage_purpose: ["L", 76, 1619, 372, 1666],
  type_approval_no: ["L", 371, 1634, 712, 1669],
  owner_tax_id: ["R", 900, 821, 1345, 871],
  owner_surname: ["R", 912, 882, 1345, 926],
  owner_first_name: ["R", 770, 948, 1345, 986],
  owner_address: ["R", 750, 1017, 1350, 1083],
  rights_holders: ["R", 762, 1162, 1056, 1356],
  notary_sale_date: ["R", 1062, 1140, 1345, 1176],
  notary_sale_no: ["R", 1062, 1200, 1345, 1236],
  notary_name: ["R", 1062, 1262, 1345, 1356],
  other_info: ["R", 745, 1387, 1056, 1428],
  document_serial: ["R", 1050, 1606, 1347, 1658],
};

type Affine = [number, number, number, number, number, number]; // x' = a x + b y + c ; y' = d x + e y + f

const key = (t: string) => trFold(t).toLocaleUpperCase("en-US");

function solve3(m: number[][], v: number[]): number[] | null {
  // Cramer
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const D = det(m);
  if (Math.abs(D) < 1e-9) return null;
  return [0, 1, 2].map(
    (c) => det(m.map((row, r) => row.map((x, k) => (k === c ? v[r] : x)))) / D,
  );
}

function fitAffine(
  pairs: { tx: number; ty: number; ix: number; iy: number }[],
): Affine | null {
  if (pairs.length >= 3) {
    // en küçük kareler: [x y 1] → ix ve iy ayrı ayrı
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const vx = [0, 0, 0];
    const vy = [0, 0, 0];
    for (const p of pairs) {
      const r = [p.tx, p.ty, 1];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) M[i][j] += r[i] * r[j];
        vx[i] += r[i] * p.ix;
        vy[i] += r[i] * p.iy;
      }
    }
    const sx = solve3(M, vx);
    const sy = solve3(M, vy);
    if (sx && sy) return [sx[0], sx[1], sx[2], sy[0], sy[1], sy[2]];
  }
  if (pairs.length >= 2) {
    // ölçek + kaydırma (eşit ölçek)
    const [p, q] = pairs;
    const td = Math.hypot(q.tx - p.tx, q.ty - p.ty);
    if (td < 50) return null;
    const s = Math.hypot(q.ix - p.ix, q.iy - p.iy) / td;
    return [s, 0, p.ix - s * p.tx, 0, s, p.iy - s * p.ty];
  }
  return null;
}

const apply = (a: Affine, x: number, y: number) =>
  [a[0] * x + a[1] * y + a[2], a[3] * x + a[4] * y + a[5]] as const;

/** Etiketlerden sayfa başına dönüşüm. Yeterli etiket yoksa (eski tip ruhsat vb.) o sayfa atlanır. */
export function locateTemplate(
  segments: PlacedText[],
): Partial<Record<Page, Affine>> {
  const result: Partial<Record<Page, Affine>> = {};
  for (const page of ["L", "R"] as Page[]) {
    let pairs: { tx: number; ty: number; ix: number; iy: number }[] = [];
    for (const a of ANCHORS.filter((x) => x.page === page)) {
      // aynı etiket birden çok geçişte okunmuş olabilir — hepsi eklenir (ortalama gibi davranır)
      for (const s of segments) {
        const k = key(s.text);
        if (a.re.test(k) && !(a.not && a.not.test(k)))
          pairs.push({ tx: a.x, ty: a.y, ix: s.x0, iy: s.y0 });
      }
    }
    // Aykırıları at: ilk uyumdan sonra kalıntısı büyük olanlar (yanlış etiket eşleşmesi)
    for (let round = 0; round < 3; round++) {
      const aff = fitAffine(pairs);
      if (!aff) break;
      const scale = Math.sqrt(Math.abs(aff[0] * aff[4] - aff[1] * aff[3]));
      const res = pairs.map((p) => {
        const [x, y] = apply(aff, p.tx, p.ty);
        return Math.hypot(x - p.ix, y - p.iy);
      });
      const limit = Math.max(
        25 * scale,
        [...res].sort((a, b) => a - b)[Math.floor(res.length / 2)] * 3,
      );
      const kept = pairs.filter((_, i) => res[i] <= limit);
      if (kept.length === pairs.length) break;
      pairs = kept;
    }
    const distinct = new Set(pairs.map((p) => `${p.tx},${p.ty}`));
    const aff = distinct.size >= 4 ? fitAffine(pairs) : null;
    if (aff) result[page] = aff;
  }
  return result;
}

/**
 * Şablondaki her değer kutusunu fotoğraftan kes, verilen bulanıklıklarla
 * görsellere çevir. Dönen liste: [alan, görsel] — hepsi tek seferde OCR'a verilir.
 */
/** Kısa sayı kutuları — boşluklu kesimle de okunur (tek başına duran "999"u Vision böyle daha iyi okuyor). */
const PAD_FIELDS = new Set([
  "net_weight",
  "max_laden_weight",
  "train_weight",
  "trailer_max_weight",
  "seat_count",
  "standing_capacity",
  "engine_capacity",
  "engine_power",
  "power_weight_ratio",
  "year",
  "vehicle_class",
]);

export function cropTemplateCells(
  img: HTMLImageElement,
  transforms: Partial<Record<Page, Affine>>,
  blurs: number[],
): { field: string; dataUrl: string }[] {
  const out: { field: string; dataUrl: string }[] = [];
  for (const [field, [page, x0, y0, x1, y1]] of Object.entries(
    TEMPLATE_CELLS,
  )) {
    const aff = transforms[page];
    if (!aff) continue;
    const corners = [
      apply(aff, x0, y0),
      apply(aff, x1, y0),
      apply(aff, x0, y1),
      apply(aff, x1, y1),
    ];
    const sx = Math.max(0, Math.min(...corners.map((c) => c[0])));
    const sy = Math.max(0, Math.min(...corners.map((c) => c[1])));
    const ex = Math.min(
      img.naturalWidth,
      Math.max(...corners.map((c) => c[0])),
    );
    const ey = Math.min(
      img.naturalHeight,
      Math.max(...corners.map((c) => c[1])),
    );
    if (ex - sx < 8 || ey - sy < 8) continue;
    // şablon birimi başına fotoğraf pikseli — bulanıklık buna göre ölçeklenir
    const unit = Math.sqrt(Math.abs(aff[0] * aff[4] - aff[1] * aff[3]));
    // küçük fotoğraflarda kutuyu büyüt (Vision küçük yazıda zorlanıyor)
    const up = Math.max(1, Math.min(4, 4 / unit));
    const w = Math.round((ex - sx) * up);
    const h = Math.round((ey - sy) * up);
    // Kenarlara boşluk: Vision kenara değen / tek başına duran kısa yazıyı (koltuk "5", "999") zor okuyor
    for (const padded of PAD_FIELDS.has(field) ? [false, true] : [false]) {
      const padX = padded ? Math.round(Math.max(40, h * 1.2)) : 0;
      const padY = padded ? Math.round(Math.max(30, h * 0.9)) : 0;
      for (const blur of blurs) {
        const c = document.createElement("canvas");
        c.width = w + padX * 2;
        c.height = h + padY * 2;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = padded ? "#ebebeb" : "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.imageSmoothingQuality = "high";
        if (blur > 0) ctx.filter = `blur(${(blur * unit * up).toFixed(2)}px)`;
        ctx.drawImage(img, sx, sy, ex - sx, ey - sy, padX, padY, w, h);
        out.push({ field, dataUrl: c.toDataURL("image/png") });
      }
    }
  }
  return out;
}
