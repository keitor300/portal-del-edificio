import type { DemoData } from './types';
export interface DemoRepository { load():DemoData|null; save(data:DemoData):void }
const KEY='portal-edificio-demo-v1';
export const repository:DemoRepository={load(){try{const raw=localStorage.getItem(KEY);if(!raw)return null;const value=JSON.parse(raw);if(value.version!==1||!value.data?.settings||!Array.isArray(value.data.notices))return null;return value.data;}catch{return null;}},save(data){localStorage.setItem(KEY,JSON.stringify({version:1,data}));}};
