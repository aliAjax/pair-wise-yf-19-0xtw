import type { HistoryEvent, Photo, Specimen } from "./types";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

interface SeedSpec {
  code: string;
  species: string;
  locality: string;
  altitude: string;
  habitat: string;
  collectors: string;
  ago: number;
  pressed: boolean;
  identified?: boolean;
  shelf?: string;
  photos: ("whole" | "label" | "habitat")[];
  returned?: string;
}

const SEEDS: SeedSpec[] = [
  {
    code: "HX-20250612-07",
    species: "色木槭 Acer mono",
    locality: "湖北神农架 板仓乡 蛇倒退沟",
    altitude: "1420 m",
    habitat: "落叶阔叶林下阴坡，腐殖土较厚",
    collectors: "周明远、林知秋",
    ago: 3,
    pressed: true,
    photos: ["whole", "label"],
  },
  {
    code: "HX-20250612-11",
    species: "荚蒾属待定 Viburnum sp.",
    locality: "湖北神农架 板仓乡 蛇倒退沟",
    altitude: "1380 m",
    habitat: "沟谷溪边灌丛",
    collectors: "周明远、林知秋",
    ago: 2,
    pressed: true,
    photos: ["whole", "label", "habitat"],
  },
  {
    code: "HX-20250613-03",
    species: "蕨类（待检）",
    locality: "湖北神农架 阴峪河",
    altitude: "1650 m",
    habitat: "阴湿沟谷石缝，苔藓层",
    collectors: "林知秋",
    ago: 2,
    pressed: true,
    photos: ["whole", "habitat"],
    returned: "采集号与野外记录本不一致，疑似应为 HX-20250613-08，请核对",
  },
  {
    code: "HX-20250611-18",
    species: "毛茛 Ranunculus japonicus",
    locality: "湖北神农架 大九湖",
    altitude: "1760 m",
    habitat: "亚高山沼泽草甸边缘",
    collectors: "陈嘉禾、周明远",
    ago: 5,
    pressed: true,
    identified: true,
    photos: ["whole", "label", "habitat"],
  },
  {
    code: "HX-20250610-02",
    species: "一年蓬 Erigeron annuus",
    locality: "湖北神农架 大九湖",
    altitude: "1740 m",
    habitat: "路边荒地",
    collectors: "陈嘉禾",
    ago: 8,
    pressed: true,
    identified: true,
    shelf: "B-12-04",
    photos: ["whole", "label", "habitat"],
  },
  {
    code: "HX-20250614-01",
    species: "（待定名）",
    locality: "湖北神农架 金猴岭",
    altitude: "2100 m",
    habitat: "针阔混交林",
    collectors: "周明远",
    ago: 1,
    pressed: false,
    photos: [],
  },
];

function drawBlob(
  kind: "whole" | "label" | "habitat",
  sp: SeedSpec
): Blob {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;

  if (kind === "label") {
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(0, 0, 960, 720);
    ctx.strokeStyle = "#b8a87e";
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 60, 840, 600);
    ctx.fillStyle = "#3f3426";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText("HERBARIUM · 标本签", 96, 150);
    ctx.font = "34px Georgia, serif";
    const lines = [
      `采集号：${sp.code}`,
      `物种：${sp.species}`,
      `地点：${sp.locality}`,
      `海拔：${sp.altitude}`,
      `生境：${sp.habitat.slice(0, 14)}`,
      `采集人：${sp.collectors}`,
    ];
    lines.forEach((t, i) => ctx.fillText(t, 96, 240 + i * 66));
  } else if (kind === "whole") {
    ctx.fillStyle = "#eef3ea";
    ctx.fillRect(0, 0, 960, 720);
    ctx.strokeStyle = "#8fa585";
    ctx.lineWidth = 2;
    for (let x = 0; x < 960; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(960, y);
      ctx.stroke();
    }
    // 茎
    ctx.strokeStyle = "#3f6b3a";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(480, 660);
    ctx.bezierCurveTo(460, 460, 510, 320, 470, 120);
    ctx.stroke();
    // 叶
    ctx.fillStyle = "#5c8a4f";
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const y = 620 - t * 480;
      const side = i % 2 === 0 ? -1 : 1;
      ctx.save();
      ctx.translate(480, y);
      ctx.rotate(side * 0.5);
      ctx.beginPath();
      ctx.ellipse(side * 70, 0, 80, 26, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 花
    ctx.fillStyle = "#d98a3c";
    ctx.beginPath();
    ctx.arc(470, 110, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4d9a4";
    ctx.font = "28px serif";
    ctx.fillText(`压制标本示意 · ${sp.code}`, 60, 690);
  } else {
    ctx.fillStyle = "#cdd9c4";
    ctx.fillRect(0, 0, 960, 720);
    // 远山
    ctx.fillStyle = "#9fb49a";
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.lineTo(200, 300);
    ctx.lineTo(380, 460);
    ctx.lineTo(560, 260);
    ctx.lineTo(780, 440);
    ctx.lineTo(960, 320);
    ctx.lineTo(960, 720);
    ctx.lineTo(0, 720);
    ctx.fill();
    // 近景林木
    ctx.fillStyle = "#5e7a52";
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 110;
      ctx.beginPath();
      ctx.moveTo(x, 620);
      ctx.lineTo(x + 44, 380);
      ctx.lineTo(x + 88, 620);
      ctx.fill();
    }
    ctx.fillStyle = "#f7faf4";
    ctx.font = "28px serif";
    ctx.fillText(`${sp.locality} · 海拔 ${sp.altitude}`, 60, 80);
  }

  const url = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = url.split(",")[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: "image/jpeg" });
}

const NAME: Record<"whole" | "label" | "habitat", string> = {
  whole: "整株.jpg",
  label: "标签.jpg",
  habitat: "生境.jpg",
};

export async function buildSeed(): Promise<Specimen[]> {
  const list: Specimen[] = [];
  SEEDS.forEach((sp, si) => {
    const sid = `seed-${si}`;
    const created = now - sp.ago * DAY;
    let hi = 0;
    const H = (text: string, by: string, at: number): HistoryEvent => ({
      id: `${sid}-h${hi++}`,
      at,
      by,
      text,
    });
    const history: HistoryEvent[] = [H("登记标本记录", "周明远", created)];
    let pi = 0;
    const photos: Photo[] = sp.photos.map((cat) => ({
      id: `${sid}-p${pi++}`,
      category: cat,
      blob: drawBlob(cat, sp),
      name: NAME[cat],
      at: created + 5 * 3600_000,
      by: "林知秋",
    }));

    let pressed = sp.pressed;
    let pressedAt: number | undefined;
    let pressedBy: string | undefined;
    if (pressed) {
      pressedAt = created + 2 * 3600_000;
      pressedBy = "周明远";
      history.push(H("压制完成，进入补照队列", pressedBy, pressedAt));
    }
    if (photos.length) {
      const labels = sp.photos
        .map((c) => (c === "whole" ? "整株" : c === "label" ? "标签" : "生境"))
        .join("、");
      history.push(H(`上传照片：${labels}`, "林知秋", created + 5 * 3600_000));
    }

    const returns = sp.returned
      ? [
          {
            id: `${sid}-r0`,
            at: now - 1 * DAY,
            by: "陈嘉禾",
            reason: sp.returned,
            resolved: false,
          },
        ]
      : [];
    if (sp.returned) {
      history.push(H(`退回修改：${sp.returned}`, "陈嘉禾", now - DAY));
    }

    let identified = sp.identified ?? false;
    let identifiedAt: number | undefined;
    let identifiedBy: string | undefined;
    if (identified) {
      identifiedAt = now - (sp.shelf ? 4 * DAY : 20 * 3600_000);
      identifiedBy = "陈嘉禾";
      history.push(H("鉴定通过", identifiedBy, identifiedAt));
    }

    let shelf: Specimen["shelf"];
    if (sp.shelf) {
      const [cabinet, ...rest] = sp.shelf.split("-");
      shelf = {
        code: sp.shelf,
        cabinet,
        position: rest.join("-"),
        at: now - 3 * DAY,
        by: "陈嘉禾",
      };
      history.push(H(`分配柜位 ${sp.shelf}，上柜`, shelf.by, shelf.at));
    }

    list.push({
      id: sid,
      code: sp.code,
      species: sp.species,
      locality: sp.locality,
      altitude: sp.altitude,
      habitat: sp.habitat,
      collectors: sp.collectors,
      pressed,
      pressedAt,
      pressedBy,
      identified,
      identifiedAt,
      identifiedBy,
      photos,
      returns,
      history,
      shelf,
      createdAt: created,
      updatedAt: created,
    });
  });
  return list;
}
