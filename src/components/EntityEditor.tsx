import { useState, type FormEvent } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import type { Attachment, Entity } from '../lib/types';
import { id,today } from '../lib/utils';
import { Field, FormPanel, Modal, UploadField } from './UI';
import { useAsyncAction } from '../hooks/useAsyncAction';
export interface EditField { key:'title'|'description'|'category'|'status'|'date'|'provider'|'amount'|'progress'|'startDate'|'place'|'type'|'contact'|'phone'|'email'|'summary';label:string;type?:'text'|'textarea'|'date'|'number'|'email';options?:string[];required?:boolean }
export function EntityEditor({title,item,fields,onSave,onClose,attachment=true}:{title:string;item?:Entity;fields:EditField[];onSave:(item:Entity)=>void|Promise<void>;onClose:()=>void;attachment?:boolean}) {
  const [file,setFile]=useState<Attachment|undefined>(item?.attachment);
  const [entityId]=useState(()=>item?.id??id());
  const action=useAsyncAction();
  const close=()=>{if(!action.isPending())onClose();};
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const result:Entity={id:entityId,title:'',description:'',date:today(),...item,attachment:file};
    for(const f of fields){const value=String(form.get(f.key)??'').trim();Object.assign(result,{[f.key]:f.type==='number'?Number(value):value});}
    if(!result.title.trim())return;
    void action.run(async()=>{await onSave(result);onClose();});
  }
  return <Modal title={title} onClose={close} icon={<FileText size={23} aria-hidden="true"/>}>
    <form onSubmit={submit} className="form-grid entity-editor-form" aria-busy={action.busy}>
      <FormPanel title="Información" description="Completá los datos que verán los propietarios." icon={<FileText size={21} aria-hidden="true"/>}>
        {fields.map(f=><Field label={f.label} key={f.key}>{f.options?<select aria-label={f.label} name={f.key} defaultValue={String(item?.[f.key]??f.options[0])} required={f.required}>{f.options.map(o=><option key={o}>{o}</option>)}</select>:f.type==='textarea'?<textarea name={f.key} defaultValue={String(item?.[f.key]??'')} rows={4} required={f.required} maxLength={3000}/>:<input name={f.key} type={f.type??'text'} defaultValue={String(item?.[f.key]??(f.type==='date'?today():''))} required={f.required??f.key==='title'} min={f.type==='number'?0:undefined} max={f.key==='progress'?100:undefined} step={f.key==='amount'?'0.01':undefined} maxLength={200}/>}</Field>)}
      </FormPanel>
      {attachment&&<FormPanel title="Archivo adjunto" description="Sumá el documento o comprobante si corresponde." icon={<Paperclip size={21} aria-hidden="true"/>} tone="amber"><UploadField value={file} onChange={setFile}/></FormPanel>}
      {action.error&&<p role="alert" className="error">{action.error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={action.busy} onClick={close}>Cancelar</button><button className="button" type="submit" disabled={action.busy}>{action.busy?'Guardando…':'Guardar'}</button></div>
    </form>
  </Modal>;
}
