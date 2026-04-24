import JSZip from "jszip";

export interface DatasetBundle {
  file: File;
  datasetName: string;
  originalFileCount: number;
}

function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}

function inferDatasetName(files: File[]): string {
  const withPath = files.find((file) => file.webkitRelativePath);
  if (withPath?.webkitRelativePath) {
    const root = withPath.webkitRelativePath.split("/")[0]?.trim();
    if (root) return root;
  }

  if (files.length === 1) {
    return stripExtension(files[0].name) || "dataset";
  }

  return `dataset-${Date.now()}`;
}

function normalizeEntryName(file: File, index: number): string {
  const relativePath = file.webkitRelativePath?.trim();
  if (relativePath) {
    return relativePath;
  }
  return `files/${index + 1}-${file.name}`;
}

export async function createDatasetBundle(files: File[]): Promise<DatasetBundle> {
  if (files.length === 0) {
    throw new Error("No files selected.");
  }

  const isSingleZip = files.length === 1 && files[0].name.toLowerCase().endsWith(".zip");
  const datasetName = inferDatasetName(files);

  if (isSingleZip) {
    return {
      file: files[0],
      datasetName: stripExtension(files[0].name) || datasetName,
      originalFileCount: 1,
    };
  }

  const zip = new JSZip();
  files.forEach((file, index) => {
    zip.file(normalizeEntryName(file, index), file);
  });

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const zipFile = new File([zipBlob], `${datasetName}.zip`, {
    type: "application/zip",
  });

  return {
    file: zipFile,
    datasetName,
    originalFileCount: files.length,
  };
}