import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

const runtimeGlobal = globalThis as typeof globalThis & {
  Blob?: unknown;
  File?: unknown;
};

if (typeof runtimeGlobal.Blob === 'undefined') {
  (runtimeGlobal as any).Blob = NodeBlob;
}

if (typeof runtimeGlobal.File === 'undefined') {
  (runtimeGlobal as any).File = NodeFile;
}
