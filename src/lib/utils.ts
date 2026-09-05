import type { Attachment } from './types';
export const id = () => crypto.randomUUID();
export const today = () => localDate(new Date());
export function localDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function relativeDate(days: number) { const d = new Date(); d.setDate(d.getDate()+days); return localDate(d); }
export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('es-AR', options ?? { day:'numeric',month:'long' });
export const money = (n: number) => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
export const demoPdf: Attachment = { name:'Documento-demo.pdf',url:'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMTQ0XSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA1MSA+PgpzdHJlYW0KQlQKL0YxIDE4IFRmCjEwIDEwMCBUZAooRG9jdW1lbnRvIGRlbW8gZGVsIFBvcnRhbCBkZWwgRWRpZmljaW8pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwMCAwMDAwMCBuIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwMTcgMDAwMDAgbiAKMDAwMDAwMDA1MSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDMwCiUlRU9GCg==',type:'application/pdf' };
export async function readAttachment(file: File): Promise<Attachment> {
  if(file.size > 1024*1024) throw new Error('El archivo debe pesar menos de 1 MB.');
  if (!/^(image\/(jpeg|png|webp)|application\/pdf|text\/plain)$/.test(file.type)) throw new Error('Elegí una imagen JPG, PNG, WebP, un PDF o un archivo de texto.');
  const url = await new Promise<string>((resolve,reject)=>{ const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(file); });
  return {name:file.name,url,type:file.type};
}
export function downloadFile(attachment: Attachment) { const a=document.createElement('a');a.href=attachment.url;a.download=attachment.name;document.body.append(a);a.click();a.remove(); }
