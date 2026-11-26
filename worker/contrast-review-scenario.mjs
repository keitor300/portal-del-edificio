import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

export async function runContrastReview({ owner, admin, visitor, base }) {
  assert.equal(new URL(base).hostname,'127.0.0.1');
  const results=[];
  const groups=[
    [visitor,['/','/login','/login?mode=register','/admin','/privacidad']],
    [owner,['/demo/propietario','/demo/propietario/novedades','/demo/propietario/edificio/cuentas','/demo/propietario/edificio/expensas','/demo/propietario/edificio/documentos','/demo/propietario/edificio/reuniones','/demo/propietario/servicios/sum','/demo/propietario/servicios/reclamos','/demo/propietario/servicios/chat','/demo/propietario/notificaciones']],
    [admin,['/admin','/admin/comunicaciones','/admin/finanzas','/admin/accesos','/admin/administradores','/admin/comunidad','/admin/contenido','/admin/servicios','/admin/menu']],
  ];
  for(const width of [390,1440])for(const [page,routes] of groups){
    await page.setViewportSize({width,height:844});
    for(const route of routes){
      await page.goto(base+route);
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.getByText('Cargando portal…',{exact:true})).toHaveCount(0);
      const audit=await new AxeBuilder({page}).withRules(['color-contrast']).analyze();
      results.push({route,width,violations:audit.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary,html:node.html}))})),incomplete:audit.incomplete.map(item=>({id:item.id,count:item.nodes.length}))});
      if(page===owner&&route==='/demo/propietario')await page.screenshot({path:join(tmpdir(),`portal-simulacro-owner-contrast-${width}.png`),fullPage:true});
    }
  }
  writeFileSync(join(tmpdir(),'portal-simulacro-contrast.json'),JSON.stringify(results,null,2));
  const failures=results.filter(row=>row.violations.length);
  assert.deepEqual(failures.map(row=>({route:row.route,width:row.width,nodes:row.violations.flatMap(item=>item.nodes)})),[],'Text contrast failures; see portal-simulacro-contrast.json');
  console.log(`Simulation verified: automatic text contrast on ${results.length} screens; incomplete checks remain manual`);
}
