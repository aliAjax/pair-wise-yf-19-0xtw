import { AppState, PhotoKind, SpecimenFields } from "./types";
import {
  EMPTY_STATE,
  addPhoto,
  approveAndStore,
  cloneState,
  createSpecimen,
  markPressed,
  returnForRework,
  submitForIdentification,
  updateSpecimenFields,
} from "./domain";
import { samplePhotoDataUrl } from "./image";

interface SeedRow {
  fields: SpecimenFields;
  /** 压制状态：unpressed / pressing 留在登记端，pressed 进入后续流程 */
  press?: "unpressed" | "pressing" | "pressed";
  photos?: PhotoKind[];
  stage?: "identifying" | "stored" | "rework";
  cabinet?: string;
  rework?: { wrongSpecies?: string; reason: string };
  offsetMin: number; // 相对当前的创建时间偏移（分钟）
}

const ROWS: SeedRow[] = [
  {
    offsetMin: 260,
    fields: {
      collectionNo: "HX-20260618-07",
      species: "紫花碎米荠",
      location: "四川 阿坝 巴朗山垭口",
      altitude: "4180 m",
      habitat: "高山流石滩下方湿润草甸",
      collector: "沈青",
    },
    press: "unpressed",
  },
  {
    offsetMin: 210,
    fields: {
      collectionNo: "HX-20260618-06",
      species: "巴朗山柳兰",
      location: "四川 阿坝 巴朗山垭口",
      altitude: "4050 m",
      habitat: "灌丛边缘向阳坡地",
      collector: "沈青",
    },
    press: "pressing",
  },
  {
    offsetMin: 170,
    fields: {
      collectionNo: "HX-20260617-03",
      species: "槭属待定",
      location: "四川 雅安 喇叭河保护区",
      altitude: "1860 m",
      habitat: "常绿阔叶与落叶阔叶混交林林下",
      collector: "岑舟",
    },
    photos: ["whole"],
  },
  {
    offsetMin: 130,
    fields: {
      collectionNo: "HX-20260617-05",
      species: "狭叶冬青",
      location: "四川 雅安 喇叭河保护区",
      altitude: "1920 m",
      habitat: "溪沟旁常绿阔叶林缘",
      collector: "岑舟",
    },
    photos: ["whole", "label", "habitat"],
  },
  {
    offsetMin: 95,
    fields: {
      collectionNo: "HX-20260616-11",
      species: "长果溲疏",
      location: "云南 迪庆 白马雪山",
      altitude: "3120 m",
      habitat: "云南松林下石砾坡",
      collector: "和玉梅",
    },
    photos: ["whole", "label", "habitat"],
    stage: "identifying",
  },
  {
    offsetMin: 70,
    fields: {
      collectionNo: "HX-20260616-09",
      species: "菊科待查",
      location: "云南 迪庆 白马雪山",
      altitude: "3300 m",
      habitat: "高山栎灌丛草坡",
      collector: "和玉梅",
    },
    photos: ["whole", "label", "habitat"],
    stage: "stored",
    cabinet: "B-12-04",
  },
  {
    offsetMin: 55,
    fields: {
      collectionNo: "HX-20260616-02",
      species: "黄花稔",
      location: "云南 迪庆 纳帕海周边",
      altitude: "3260 m",
      habitat: "湖边弃耕地，向阳干燥处",
      collector: "和玉梅",
    },
    photos: ["whole", "label", "habitat"],
    stage: "rework",
    rework: {
      wrongSpecies: "白背黄花稔",
      reason: "种名疑似写错：叶背密被星状绒毛，与黄花稔原描述不符，请核对后改为白背黄花稔",
    },
  },
  {
    offsetMin: 30,
    fields: {
      collectionNo: "HX-20260615-04",
      species: "苞序葶苈",
      location: "四川 阿坝 巴朗山垭口",
      altitude: "4250 m",
      habitat: "流石滩石缝，融雪浸润处",
      collector: "沈青",
    },
    photos: ["whole", "label", "habitat"],
    stage: "stored",
    cabinet: "A-03-02",
  },
];

function shiftIso(base: Date, offsetMin: number): string {
  return new Date(base.getTime() - offsetMin * 60_000).toISOString();
}

/** 构造一份覆盖全流程的演示数据（可重复加载，不依赖网络） */
export function buildSeedState(): AppState {
  const state = cloneState(EMPTY_STATE);
  state.currentUser = "林砚";
  const base = new Date("2026-06-19T09:00:00+08:00");

  for (const row of ROWS) {
    const created = createSpecimen(state, row.fields, "林砚");
    if (!created.ok) continue;
    const sp = created.value;
    const createdAt = shiftIso(base, row.offsetMin);
    sp.createdAt = createdAt;
    sp.events.forEach((e, i) => {
      e.at = shiftIso(base, row.offsetMin - i);
    });

    if (row.press === "pressing") {
      sp.pressStatus = "pressing";
      sp.stage = "unpressed";
      continue;
    }
    if (row.press === "unpressed") continue;

    const pressed = markPressed(state, sp.id, "阿卓");
    if (!pressed.ok) continue;

    for (const kind of row.photos ?? []) {
      const label = { whole: "整株", label: "标签", habitat: "生境" }[kind];
      addPhoto(
        state,
        sp.id,
        kind,
        samplePhotoDataUrl(kind, row.fields.collectionNo, row.fields.species),
        `${row.fields.collectionNo}-${label}.svg`,
        "阿卓",
      );
    }

    if (row.stage === "identifying" || row.stage === "stored") {
      submitForIdentification(state, sp.id, "阿卓");
    }
    if (row.stage === "stored" && row.cabinet) {
      approveAndStore(state, sp.id, row.cabinet, "林砚");
    }
    if (row.stage === "rework" && row.rework) {
      submitForIdentification(state, sp.id, "阿卓");
      returnForRework(state, sp.id, row.rework.reason, "林砚");
      if (row.rework.wrongSpecies) {
        updateSpecimenFields(
          state,
          sp.id,
          { species: row.rework.wrongSpecies },
          "林砚",
        );
      }
    }

    // 统一时间轴：每个事件间隔 2 分钟
    const specimen = state.specimens[sp.id];
    specimen.events.forEach((e, i) => {
      e.at = shiftIso(base, row.offsetMin - 3 * (specimen.events.length - i));
    });
    specimen.updatedAt = specimen.events[specimen.events.length - 1].at;
    specimen.photos.forEach((p, i) => {
      p.addedAt = shiftIso(base, row.offsetMin - 6 - i);
    });
    if (specimen.storedAt) {
      specimen.storedAt = specimen.updatedAt;
    }
  }

  // 柜位记录按上柜时间排序
  state.cabinets.sort((a, b) => (a.storedAt < b.storedAt ? 1 : -1));
  return state;
}
