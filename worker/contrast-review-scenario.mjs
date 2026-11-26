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
      const incomplete=[];
      for(const item of audit.incomplete){
        const nodes=[];
        for(const [index,node] of item.nodes.entries()){
          assert.equal(node.target.length,1,'Manual contrast capture expects a document selector');
          const element=page.locator(node.target[0]);
          const capture=join(tmpdir(),`portal-contrast-manual-${width}-${results.length}-${index}.png`);
          await element.scrollIntoViewIfNeeded();
          await element.screenshot({path:capture,animations:'disabled'});
          const styles=await element.evaluate(element=>{
            const result=[];
            for(let current=element;current&&result.length<6;current=current.parentElement){
              const css=globalThis.getComputedStyle(current);
              result.push({tag:current.tagName,className:current.className,color:css.color,background:css.backgroundColor,image:css.backgroundImage,fontSize:css.fontSize,fontWeight:css.fontWeight,opacity:css.opacity});
            }
            return result;
          });
          nodes.push({target:node.target,html:node.html,checks:[...node.any,...node.all,...node.none].map(check=>({id:check.id,message:check.message,data:check.data})),capture,styles});
        }
        incomplete.push({id:item.id,count:nodes.length,nodes});
      }
      results.push({route,width,violations:audit.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary,html:node.html}))})),incomplete});
      if(page===owner&&route==='/demo/propietario')await page.screenshot({path:join(tmpdir(),`portal-simulacro-owner-contrast-${width}.png`),fullPage:true});
    }
  }
  writeFileSync(join(tmpdir(),'portal-simulacro-contrast.json'),JSON.stringify(results,null,2));
  const failures=results.filter(row=>row.violations.length);
  assert.deepEqual(failures.map(row=>({route:row.route,width:row.width,nodes:row.violations.flatMap(item=>item.nodes)})),[],'Text contrast failures; see portal-simulacro-contrast.json');
  // Axe leaves single-character counters incomplete even when it measured both colors.
  const measuredFailures=results.flatMap(row=>row.incomplete.flatMap(item=>item.nodes.flatMap(node=>node.checks.filter(check=>{
    const data=check.data;
    return data?.fgColor&&data?.bgColor&&Number.isFinite(data.contrastRatio)&&data.contrastRatio<Number.parseFloat(data.expectedContrastRatio);
  }).map(check=>({route:row.route,width:row.width,target:node.target,data:check.data})))));
  assert.deepEqual(measuredFailures,[],'Measured contrast failures in incomplete checks; see portal-simulacro-contrast.json');
  console.log(`Simulation verified: automatic text contrast on ${results.length} screens; incomplete checks remain manual`);
}
