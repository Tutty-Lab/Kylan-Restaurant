import { afterEach, describe, expect, it, vi } from "vitest";
import { savePdfFile } from "../savePdfFile";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("save PDF to disk", () => {
  it("writes the PDF to the chosen file without navigation or download links", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const picker = vi.fn().mockResolvedValue({ createWritable: async () => ({write,close}) });
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    expect(await savePdfFile(blob,"Kylan.pdf")).toBe("saved");
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({suggestedName:"Kylan.pdf"}));
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledOnce();
  });
  it("cancelling the picker never triggers a download or opens a PDF", async () => {
    vi.stubGlobal("window", {showSaveFilePicker: vi.fn().mockRejectedValue(new DOMException("Cancelled","AbortError"))});
    expect(await savePdfFile(new Blob(),"Kylan.pdf")).toBe("cancelled");
  });
  it("reports disk write failure instead of claiming success", async () => {
    vi.stubGlobal("window", {showSaveFilePicker: async () => ({createWritable: async () => ({write: async () => {throw new Error("Disk full");},close: vi.fn()})})});
    await expect(savePdfFile(new Blob(),"Kylan.pdf")).rejects.toThrow("Disk full");
  });
  it("uses a binary attachment when the file picker is unsupported", async () => {
    vi.stubGlobal("window", {});
    const anchor = {href:"",download:"",hidden:false,click:vi.fn(),remove:vi.fn()};
    vi.stubGlobal("document", {createElement: () => anchor,body:{appendChild:vi.fn()}});
    const objectUrl = vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:test");
    vi.stubGlobal("setTimeout",vi.fn());
    expect(await savePdfFile(new Blob(["pdf"]),"Kylan.pdf")).toBe("download");
    expect((objectUrl.mock.calls[0][0] as Blob).type).toBe("application/octet-stream");
    expect(anchor.download).toBe("Kylan.pdf");
    expect(anchor.click).toHaveBeenCalledOnce();
  });
});
