// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readImageFile, samplePhotoDataUrl } from "../src/image";

describe("samplePhotoDataUrl", () => {
  it("三类占位照均为可编码 SVG dataURL", () => {
    for (const kind of ["whole", "label", "habitat"] as const) {
      const url = samplePhotoDataUrl(kind, "HX-1", "测试种");
      expect(url.startsWith("data:image/svg+xml")).toBe(true);
      expect(decodeURIComponent(url.slice(url.indexOf(",") + 1))).toContain("<svg");
    }
  });

  it("canvas 不可用时 readImageFile 降级返回原图 dataURL", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    // jsdom 无 canvas 实现：readAsDataURL 可工作，压缩阶段自然失败并降级
    const url = await readImageFile(file);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  }, 10000);
});
