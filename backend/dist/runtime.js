import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
const runtimeGlobal = globalThis;
if (typeof runtimeGlobal.Blob === 'undefined') {
    runtimeGlobal.Blob = NodeBlob;
}
if (typeof runtimeGlobal.File === 'undefined') {
    runtimeGlobal.File = NodeFile;
}
