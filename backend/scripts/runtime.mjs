import { Blob, File } from 'node:buffer';

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob;
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = File;
}
