type SaveHandle = {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
};
type SaveWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<SaveHandle>;
};

export async function savePdfFile(blob: Blob, filename: string): Promise<"saved" | "cancelled" | "download"> {
  const host = window as SaveWindow;
  if (host.showSaveFilePicker) {
    try {
      const handle = await host.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }
  // Binary attachment prevents browsers from routing this action to a PDF viewer.
  const url = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "download";
}
