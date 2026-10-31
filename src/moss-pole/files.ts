// Saving files: inside a Claude artifact the viewer's download prompt is used;
// on the website a normal browser download.
import JSZip from "jszip";
let dl: any = null;
if (typeof window !== "undefined") {
  const w = window as any;   // only inside a Claude artifact
  if (w.claude?.use) w.claude.use("downloads").then((x: any) => (dl = x)).catch(() => {});
}
const ALLOWED = ["json", "zip", "txt", "csv", "md"];

export async function saveFile(name: string, data: Blob | Uint8Array | string): Promise<"saved" | "declined" | "fallback"> {
  const ext = name.split(".").pop()!.toLowerCase();
  if (dl) {
    let fname = name, payload: any = data;
    if (!ALLOWED.includes(ext)) {                 // e.g. .3mf: wrap it in a zip
      const z = new JSZip(); z.file(name, data); payload = await z.generateAsync({ type: "blob" }); fname = name.replace(/\.[^.]+$/, ".zip");
    }
    try { await dl.save({ filename: fname, data: payload }); return "saved"; }
    catch (e: any) { if (e?.code === "declined") return "declined"; }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return dl ? "fallback" : "saved";
  } catch { return "fallback"; }
}
