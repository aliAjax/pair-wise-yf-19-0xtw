import { PhotoKind } from "./types";

const MAX_EDGE = 1400;

/** 上传照片统一压缩为 JPEG dataURL，避免 localStorage 被原图撑爆 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("读取照片失败"));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(
  dataUrl: string,
  maxEdge = MAX_EDGE,
  quality = 0.72,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error("照片解码超时")), 5000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("照片解码失败"));
    };
    image.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxEdge || height > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function readImageFile(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  try {
    return await compressImage(raw);
  } catch {
    return raw; // 压缩失败时退回原图
  }
}

const PALETTES: Record<PhotoKind, [string, string]> = {
  whole: ["#2f6f4e", "#7fae7a"],
  label: ["#6b5a2f", "#caa85a"],
  habitat: ["#1f5c6b", "#69a8b4"],
};

/** 内置演示用占位照（SVG dataURL），无网络也能演示三类照片齐全的流程 */
export function samplePhotoDataUrl(
  kind: PhotoKind,
  collectionNo: string,
  label: string,
): string {
  const [dark, light] = PALETTES[kind];
  const svg =
    kind === "label"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
<rect width="900" height="560" fill="#f4efe0"/>
<rect x="40" y="40" width="820" height="480" fill="none" stroke="${dark}" stroke-width="3"/>
<g fill="none" stroke="${dark}" stroke-width="2" opacity="0.85">
<line x1="70" y1="130" x2="830" y2="130"/><line x1="70" y1="210" x2="830" y2="210"/>
<line x1="70" y1="290" x2="830" y2="290"/><line x1="70" y1="370" x2="830" y2="370"/>
<line x1="70" y1="450" x2="600" y2="450"/>
<line x1="320" y1="70" x2="320" y2="520"/>
</g>
<g font-family="serif" fill="${dark}">
<text x="90" y="112" font-size="30">采集号 COLLECTION NO.</text>
<text x="350" y="112" font-size="30">${collectionNo}</text>
<text x="90" y="192" font-size="30">物种 SPECIES</text>
<text x="350" y="192" font-size="30">${label}</text>
<text x="90" y="272" font-size="26">地点 LOCALITY / ALT.</text>
<text x="90" y="352" font-size="26">采集人 COLLECTOR / DATE</text>
<text x="90" y="432" font-size="26">生境 HABITAT</text>
</g></svg>`
      : kind === "whole"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620">
<rect width="900" height="620" fill="#eef3ea"/>
<g fill="${light}" opacity="0.55">
<ellipse cx="450" cy="300" rx="220" ry="150"/>
<ellipse cx="300" cy="360" rx="120" ry="80"/>
<ellipse cx="600" cy="240" rx="130" ry="90"/>
</g>
<g stroke="${dark}" stroke-width="7" stroke-linecap="round" fill="none">
<path d="M450 560 C440 430 470 300 450 90"/>
<path d="M450 420 C380 380 320 360 250 300"/>
<path d="M455 360 C530 330 590 300 660 240"/>
<path d="M450 500 C520 470 580 470 650 430"/>
</g>
<g fill="${dark}">
<ellipse cx="240" cy="292" rx="46" ry="16" transform="rotate(-24 240 292)"/>
<ellipse cx="668" cy="232" rx="50" ry="17" transform="rotate(-28 668 232)"/>
<ellipse cx="656" cy="424" rx="44" ry="15" transform="rotate(-16 656 424)"/>
<ellipse cx="450" cy="84" rx="40" ry="22"/>
</g>
<text x="30" y="592" font-family="serif" font-size="26" fill="${dark}">${label} · ${collectionNo} · 整株标本照</text>
</svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620">
<rect width="900" height="620" fill="#e4f0f1"/>
<polygon points="0,430 180,300 340,400 520,250 720,420 900,330 900,620 0,620" fill="${light}" opacity="0.8"/>
<polygon points="0,500 220,420 430,500 650,400 900,490 900,620 0,620" fill="${dark}" opacity="0.55"/>
<g fill="${dark}" opacity="0.8">
<path d="M120 470 l8 -120 8 120 z"/>
<path d="M700 452 l7 -100 7 100 z"/>
</g>
<circle cx="760" cy="110" r="46" fill="#e9c46a" opacity="0.9"/>
<text x="30" y="60" font-family="serif" font-size="26" fill="${dark}">${label} · ${collectionNo} · 野外生境照</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
