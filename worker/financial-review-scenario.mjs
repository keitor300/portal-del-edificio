import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';

export async function runFinancialReview({ admin, owner, neighbor, base, pdf }) {
  assert.equal(new URL(base).hostname,'127.0.0.1');
  const state=async page=>(await(await page.request.get(`${base}/api/state`)).json()).data;
  const money=amount=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2,minimumFractionDigits:0}).format(amount);
  await owner.goto(`${base}/demo/propietario/edificio/cuentas`);
  await owner.getByLabel('Período',{exact:true}).selectOption('');
  const initial=await state(owner);
  for(const type of ['Ingreso','Egreso','']){
    await owner.getByLabel('Tipo',{exact:true}).selectOption(type);
    const selected=initial.movements.filter(row=>!type||row.type===type);
    await expect(owner.locator('.finance-movement')).toHaveCount(selected.length);
    for(const row of selected)await expect(owner.getByText(row.title,{exact:true})).toBeVisible();
  }
  for(const category of [...new Set(initial.movements.map(row=>row.category))]){
    await owner.getByLabel('Categoría',{exact:true}).selectOption(category);
    await expect(owner.locator('.finance-movement')).toHaveCount(initial.movements.filter(row=>row.category===category).length);
  }
  await owner.getByLabel('Categoría',{exact:true}).selectOption('Mantenimiento');
  await owner.getByLabel('Tipo',{exact:true}).selectOption('Ingreso');
  await expect(owner.getByText('No hay movimientos con estos filtros.',{exact:true})).toBeVisible();
  await expect(owner.getByRole('button',{name:/Anotar ingreso|Editar |Eliminar /})).toHaveCount(0);

  await admin.goto(`${base}/admin/finanzas`);
  await admin.getByLabel('Período',{exact:true}).selectOption('');
  await admin.getByRole('button',{name:'Editar Reparación de prueba',exact:true}).click();
  const movement=admin.getByRole('dialog',{name:'Editar movimiento de caja',exact:true});
  await movement.getByLabel('Importe en pesos',{exact:true}).fill('-1');
  await movement.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
  await expect(movement.getByRole('alert')).toContainText('importe positivo');
  assert.equal((await state(owner)).movements.find(row=>row.title==='Reparación de prueba').amount,1250.5);
  await movement.getByLabel('Importe en pesos',{exact:true}).fill('2.000,75');
  await movement.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
  await expect(movement).toHaveCount(0);
  const afterEdit=await state(owner);
  assert.equal(afterEdit.movements.find(row=>row.title==='Reparación de prueba').amount,2000.75);
  await owner.reload();
  const balance=afterEdit.settings.openingBalance+afterEdit.movements.reduce((sum,row)=>sum+(row.type==='Ingreso'?row.amount:-row.amount),0);
  await expect(owner.locator('.finance-summary > div').first()).toContainText(money(balance));
  await admin.getByRole('button',{name:'Eliminar Reparación de prueba',exact:true}).click();
  await admin.getByRole('dialog').getByRole('button',{name:'Volver',exact:true}).click();
  assert.ok((await state(owner)).movements.some(row=>row.title==='Reparación de prueba'));
  await admin.getByRole('button',{name:'Eliminar Reparación de prueba',exact:true}).click();
  await admin.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  assert.ok(!(await state(owner)).movements.some(row=>row.title==='Reparación de prueba'));

  await admin.goto(`${base}/admin/finanzas?tab=expensas`);
  await admin.getByLabel('Filtrar por unidad',{exact:true}).selectOption('7B');
  await expect(admin.locator('.finance-document')).toHaveCount(1);
  await expect(admin.locator('.finance-document')).toContainText('Unidad 7B');
  await admin.getByRole('button',{name:/Editar expensas de/}).click();
  const editing=admin.getByRole('dialog',{name:'Editar liquidación o reemplazar PDF',exact:true});
  await expect(editing.getByLabel('Unidad',{exact:true})).toBeDisabled();
  await editing.getByLabel('Reemplazar PDF',{exact:true}).setInputFiles({name:'invalido.pdf',mimeType:'application/pdf',buffer:Buffer.from('No es un PDF')});
  await expect(editing.getByRole('alert')).toContainText('PDF válido');
  await editing.getByLabel('Reemplazar PDF',{exact:true}).setInputFiles({name:'liquidacion-corregida.pdf',mimeType:'application/pdf',buffer:pdf});
  await expect(editing.getByText('liquidacion-corregida.pdf',{exact:true})).toBeVisible();
  await editing.getByLabel('Importe de la unidad en pesos',{exact:true}).fill('36000,25');
  await editing.getByRole('button',{name:'Guardar y publicar',exact:true}).click();
  await expect(editing).toHaveCount(0);
  const current=(await state(owner)).expenses[0];
  assert.equal(current.amount,36000.25);
  assert.equal(current.attachment.name,'liquidacion-corregida.pdf');
  assert.equal((await neighbor.request.get(base+current.attachment.url)).status(),404);
  await owner.goto(`${base}/demo/propietario/edificio/expensas`);
  await owner.getByRole('button',{name:'Ver PDF',exact:true}).click();
  const preview=owner.getByRole('dialog',{name:'liquidacion-corregida.pdf',exact:true});
  await expect(preview.locator('iframe')).toHaveAttribute('src',current.attachment.url);
  const downloaded=owner.waitForEvent('download');
  await preview.getByRole('button',{name:'Descargar archivo',exact:true}).click();
  const file=await downloaded;
  assert.equal(file.suggestedFilename(),'liquidacion-corregida.pdf');
  assert.equal(await file.failure(),null);
  assert.deepEqual(readFileSync(await file.path()),pdf);
  await owner.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);

  await admin.getByRole('button',{name:'Nueva liquidación',exact:true}).click();
  const historical=admin.getByRole('dialog',{name:'Nueva liquidación',exact:true});
  await historical.getByLabel('Unidad',{exact:true}).selectOption('7B');
  await historical.getByLabel('Período',{exact:true}).fill('2025-01');
  await historical.getByLabel('Vencimiento',{exact:true}).fill('2025-02-10');
  await historical.getByLabel('Importe de la unidad en pesos',{exact:true}).fill('10000');
  await historical.getByLabel('Liquidación en PDF',{exact:true}).setInputFiles({name:'historico.pdf',mimeType:'application/pdf',buffer:pdf});
  await expect(historical.getByText('historico.pdf',{exact:true})).toBeVisible();
  await historical.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await expect(historical).toHaveCount(0);
  assert.equal((await state(owner)).expenses.length,1);
  const history=admin.locator('.finance-document').filter({hasText:'enero de 2025'});
  await expect(history).toContainText('Borrador');
  await history.getByRole('button',{name:'Publicar',exact:true}).click();
  await expect(history).toContainText('Publicado');
  await owner.reload();
  await owner.getByLabel('Período del historial',{exact:true}).selectOption('2025-01');
  await expect(owner.locator('.finance-document')).toHaveCount(2);
  await expect(owner.locator('.finance-document').filter({hasText:'enero de 2025'})).toContainText('Publicado');
  await owner.screenshot({path:join(tmpdir(),'portal-simulacro-expenses-mobile.png'),fullPage:true});
  assert.equal(await owner.evaluate(()=>globalThis.document.documentElement.scrollWidth>globalThis.innerWidth),false);
  await history.getByRole('button',{name:/Eliminar expensas de/}).click();
  await admin.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(admin.getByRole('dialog')).toHaveCount(0);
  await owner.reload();
  await expect(owner.getByText('No hay liquidaciones para este período.',{exact:true})).toBeVisible();
  assert.equal((await state(owner)).expenses.length,1);

  await owner.goto(`${base}/demo/propietario/edificio/documentos`);
  const documents=(await state(owner)).documents;
  for(const doc of documents){
    await owner.getByLabel('Categoría',{exact:true}).selectOption('Todas');
    await owner.getByLabel('Buscar documento',{exact:true}).fill(doc.title);
    await expect(owner.locator('.list-row')).toHaveCount(1);
    await expect(owner.getByRole('heading',{name:doc.title,exact:true})).toBeVisible();
  }
  await owner.getByLabel('Buscar documento',{exact:true}).fill('');
  for(const category of [...new Set(documents.map(row=>row.category).filter(Boolean))]){
    await owner.getByLabel('Categoría',{exact:true}).selectOption(category);
    await expect(owner.locator('.list-row')).toHaveCount(documents.filter(row=>row.category===category).length);
  }
  await owner.getByLabel('Buscar documento',{exact:true}).fill('No existe este archivo');
  await expect(owner.locator('.list-row')).toHaveCount(0);
  await expect(owner.locator('.empty')).toBeVisible();
}
