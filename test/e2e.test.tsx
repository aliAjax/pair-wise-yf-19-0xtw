// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { STORAGE_KEY } from "../src/storage";
import { loadState } from "../src/storage";
import App from "../src/App";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function flush() {
  return act(async () => {
    await sleep(0);
  });
}

function buttons(root: ParentNode = document): HTMLButtonElement[] {
  return [...root.querySelectorAll("button")] as HTMLButtonElement[];
}

function btnByText(text: string, root: ParentNode = document): HTMLButtonElement {
  const b = buttons(root).find((x) =>
    (x.textContent ?? "").replace(/\s+/g, "").includes(text.replace(/\s+/g, "")),
  );
  if (!b) throw new Error(`找不到按钮：${text}`);
  return b;
}

function articleContaining(text: string): HTMLElement {
  const a = [...document.querySelectorAll("article")].find((x) =>
    (x.textContent ?? "").includes(text),
  );
  if (!a) throw new Error(`找不到包含「${text}」的卡片`);
  return a as HTMLElement;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await sleep(0);
  });
}

async function goto(hash: string) {
  window.location.hash = hash;
  await flush();
}

describe("补照工作台端到端", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    localStorage.clear();
    window.location.hash = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
      await sleep(0);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await sleep(0);
    });
    container.remove();
    localStorage.clear();
  });

  it("登记→压制→缺照留队→补齐送鉴定→柜位冲突换位→上柜，重开仍在", async () => {
    // 1. 载入演示数据
    await click(btnByText("载入演示数据"));
    expect(document.body.textContent).toContain("已载入演示数据");

    // 2. 默认进入补照队列：缺照片的标本提交按钮禁用并提示缺类
    const card03 = articleContaining("HX-20260617-03");
    const blocked = btnByText("缺标签、生境，留队列", card03);
    expect(blocked.disabled).toBe(true);

    // 照片齐全的标本可提交鉴定
    const card05 = articleContaining("HX-20260617-05");
    await click(btnByText("提交鉴定", card05));
    expect(document.body.textContent).toContain("已提交鉴定");
    expect(document.querySelector("main")!.textContent).not.toContain("HX-20260617-05");

    // 3. 进入鉴定筛选，搜索过滤生效
    await click(btnByText("鉴定筛选"));
    expect(document.body.textContent).toContain("HX-20260617-05");
    const speciesInput = document.querySelector<HTMLInputElement>('input[placeholder="按物种名筛选"]')!;
    await act(async () => setNativeValue(speciesInput, "不存在的物种"));
    expect(document.body.textContent).toContain("筛选无结果");
    await act(async () => setNativeValue(speciesInput, ""));

    // 4. 鉴定上柜：占用柜位 B-12-04 提示换位且记录不动
    const idCard05 = articleContaining("HX-20260617-05");
    await click(btnByText("鉴定通过", idCard05));
    const cabinetInput = document.querySelector<HTMLInputElement>('input[placeholder="如 A-03-02"]')!;
    await act(async () => setNativeValue(cabinetInput, "b-12-04"));
    expect(document.querySelector(".conflict-box")?.textContent).toContain("HX-20260616-09");
    const confirmBtn = btnByText("鉴定通过并上柜");
    expect(confirmBtn.disabled).toBe(true);
    const stateBefore = localStorage.getItem(STORAGE_KEY);

    // 换到空柜位 C-09-09，上柜成功并跳到柜位记录
    await act(async () => setNativeValue(cabinetInput, "C-09-09"));
    expect(document.querySelector(".conflict-box")).toBeNull();
    await click(btnByText("鉴定通过并上柜"));
    expect(document.body.textContent).toContain("已上柜 C-09-09");
    const cabTable = document.querySelector(".cab-table")!;
    expect(cabTable.textContent).toContain("C-09-09");
    expect(cabTable.textContent).toContain("HX-20260617-05");

    // 冲突期间没有任何写入（确认柜位记录仍是 2 条旧记录）
    expect(stateBefore).not.toBeNull();
    const before = JSON.parse(stateBefore!) as { cabinets: unknown[] };
    expect(before.cabinets).toHaveLength(2);

    // 5. 重开页面：localStorage 同一份数据，状态延续
    const persisted = loadState();
    const sp05 = Object.values(persisted.specimens).find((s) => s.collectionNo === "HX-20260617-05")!;
    expect(sp05.stage).toBe("stored");
    expect(sp05.cabinetNo).toBe("C-09-09");
    expect(persisted.cabinets).toHaveLength(3);

    // 6. 退回修改件：改物种名后旧照片保留，可重新送鉴定
    await goto("/queue");
    const card02 = articleContaining("HX-20260616-02");
    expect(card02.textContent).toContain("退回修改");
    expect(card02.textContent).toContain("退回原因");
    await click(btnByText("修改登记信息", card02));
    const speciesEdit = [...document.querySelectorAll<HTMLInputElement>(".modal input")].find(
      (i) => i.value === "白背黄花稔",
    )!;
    expect(speciesEdit).toBeTruthy();
    await act(async () => setNativeValue(speciesEdit, "白背黄花稔（已核对）"));
    await click(btnByText("保存修改"));
    expect(document.body.textContent).toContain("旧照片与退回原因均保留");

    const after = loadState();
    const sp02 = Object.values(after.specimens).find((s) => s.collectionNo === "HX-20260616-02")!;
    expect(sp02.species).toBe("白背黄花稔（已核对）");
    expect(sp02.photos).toHaveLength(3);
    expect(sp02.reworkHistory[0].reason.length).toBeGreaterThan(5);

    const card02b = articleContaining("HX-20260616-02");
    await click(btnByText("提交鉴定", card02b));
    expect(loadState().specimens[sp02.id].stage).toBe("identifying");
    expect(loadState().specimens[sp02.id].photos).toHaveLength(3);

    // 7. 新标本登记 → 压制完成 → 进入队列
    await goto("/register");
    const ph = (placeholder: string) =>
      document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[placeholder="${placeholder}"]`,
      )!;
    await act(async () => setNativeValue(ph("如 HX-20260619-01"), "HX-20260923-E2E"));
    await act(async () => setNativeValue(ph("物种名 / 科属待查"), "端到端测试种"));
    await act(async () => setNativeValue(ph("省 / 州 / 具体地点"), "测试省 测试山"));
    await act(async () => setNativeValue(ph("如 2350 m"), "8848 m"));
    await act(async () => setNativeValue(ph("林缘、溪边、草甸等生境描述"), "自动化测试生境"));
    await act(async () => setNativeValue(ph("采集人姓名"), "测试员"));
    await click(btnByText("登记标本"));
    expect(document.body.textContent).toContain("已登记采集号 HX-20260923-E2E");

    const newCard = articleContaining("HX-20260923-E2E");
    await click(btnByText("压制完成", newCard));
    const finalState = loadState();
    const created = Object.values(finalState.specimens).find(
      (s) => s.collectionNo === "HX-20260923-E2E",
    )!;
    expect(created.pressStatus).toBe("pressed");
    expect(created.stage).toBe("queue");

    // 8. 地点信息卡归并了新地点
    await goto("/locations");
    expect(document.body.textContent).toContain("测试省 测试山");
    expect(document.body.textContent).toContain("端到端测试种");
  });
});
