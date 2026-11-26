import { digest, hashPassword, randomToken, rateLimit, requireUser, verifyPassword } from './auth.mjs';
import { body, HttpError, json, text } from './http.mjs';
import { authProvider, firebaseAuthenticate, firebaseRecoveryCode, firebaseReset, validatePassword } from './firebase.mjs';

export async function recoveryRoute(request,env,path) {
  if(request.method!=='POST')return null;
  if(path==='/api/auth/recovery/request'){
    await rateLimit(env,`recovery-request:${request.headers.get('cf-connecting-ip')||'local'}`,5);
    const data=await body(request);
    const unit=text(data.unit,8).toUpperCase(),email=text(data.email,120).toLowerCase();
    // Always return the same response, including for unknown or disabled accounts.
    await env.DB.prepare(`INSERT INTO recovery_requests(user_id,requested_at)
      SELECT id,? FROM users WHERE role='owner' AND status='approved' AND unit=? AND email=?
      ON CONFLICT(user_id) DO UPDATE SET requested_at=excluded.requested_at,resolved_at=NULL`).bind(Date.now(),unit,email).run();
    return json({message:'Si los datos corresponden a una cuenta habilitada, Administración recibirá tu solicitud. Verificará tu identidad y te compartirá un enlace para elegir otra contraseña.'});
  }
  const match=/^\/api\/admin\/access\/([^/]+)\/recovery$/.exec(path);
  if(match){
    const admin=await requireUser(request,env,'admin');
    await rateLimit(env,`recovery-issue:${admin.id}`,10);
    const data=await body(request);
    if(data.verified!==true)throw new HttpError(400,'Verificá la identidad del propietario antes de generar el enlace.');
    const firebase=authProvider(env)==='firebase';
    if(firebase){
      try { await firebaseAuthenticate(env,admin,data.password); }
      catch(error){
        if(error.status===401)throw new HttpError(403,'La contraseña de Administración no es correcta.');
        throw error;
      }
    }
    else if(!await verifyPassword(data.password,admin.password_hash))throw new HttpError(403,'La contraseña de Administración no es correcta.');
    const target=await env.DB.prepare("SELECT * FROM users WHERE id=? AND role='owner' AND status='approved'").bind(match[1]).first();
    if(!target)throw new HttpError(409,'La cuenta debe estar aprobada para recuperar el acceso.');
    const token=firebase?await firebaseRecoveryCode(env,target):randomToken(),expiresAt=Date.now()+1800000;
    const result=await env.DB.batch([
      env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(match[1]),
      env.DB.prepare(`INSERT INTO password_resets(token_hash,user_id,expires_at)
        SELECT ?,id,? FROM users WHERE id=? AND role='owner' AND status='approved'`).bind(await digest(token),expiresAt,match[1]),
      env.DB.prepare("INSERT INTO audit_log(actor_id,action,entity_id) SELECT ?,'account.recovery-issued',? WHERE changes()=1").bind(admin.id,match[1]),
    ]);
    if(result[1].meta.changes!==1)throw new HttpError(409,'La cuenta debe estar aprobada para recuperar el acceso.');
    return json({path:`/login#reset=${token}`,expiresAt});
  }
  if(path==='/api/auth/recovery/reset'){
    await rateLimit(env,`recovery-reset:${request.headers.get('cf-connecting-ip')||'local'}`,10);
    const data=await body(request);
    const firebase=authProvider(env)==='firebase';
    if(typeof data.token!=='string'||!(firebase?/^f1\.[A-Za-z0-9_-]{16,1024}$/:/^[a-f0-9]{64}$/).test(data.token))throw new HttpError(400,'El enlace no es válido. Solicitá uno nuevo.');
    const tokenHash=await digest(data.token);
    const reset=await env.DB.prepare(`SELECT u.*,r.user_id FROM password_resets r JOIN users u ON u.id=r.user_id
      WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>? AND u.status='approved'`).bind(tokenHash,Date.now()).first();
    if(!reset)throw new HttpError(409,'El enlace venció o ya se utilizó. Solicitá uno nuevo.');
    if(firebase){
      validatePassword(data.password);
      // Claim once before the external call. A network failure requires a new
      // link rather than allowing two simultaneous password changes.
      const claimed=await env.DB.prepare(`UPDATE password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?
        AND EXISTS(SELECT 1 FROM users WHERE id=password_resets.user_id AND status='approved' AND auth_version=?)`)
        .bind(Date.now(),tokenHash,Date.now(),reset.auth_version).run();
      if(claimed.meta.changes!==1)throw new HttpError(409,'El enlace venció o ya se utilizó. Solicitá uno nuevo.');
      await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(reset.id).run();
      await firebaseReset(env,reset,data.token,data.password);
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET auth_version=auth_version+1 WHERE id=?').bind(reset.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(reset.id),
        env.DB.prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').bind(Date.now(),reset.id),
        env.DB.prepare('UPDATE recovery_requests SET resolved_at=? WHERE user_id=?').bind(Date.now(),reset.id),
        env.DB.prepare("INSERT INTO audit_log(actor_id,action,entity_id) VALUES (?,'account.password-reset',?)").bind(reset.id,reset.id),
      ]);
      return json({message:'Contraseña actualizada. Ingresá nuevamente con tu unidad.'});
    }
    const passwordHash=await hashPassword(data.password);
    // The write rechecks validity atomically; its trigger consumes all tokens and sessions.
    const result=await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM password_resets WHERE token_hash=? AND user_id=users.id AND used_at IS NULL AND expires_at>?)`).bind(passwordHash,reset.user_id,tokenHash,Date.now()),
      env.DB.prepare("INSERT INTO audit_log(actor_id,action,entity_id) SELECT ?,'account.password-reset',? WHERE changes()=1").bind(reset.user_id,reset.user_id),
    ]);
    if(!result[0].meta.changes)throw new HttpError(409,'El enlace venció o ya se utilizó. Solicitá uno nuevo.');
    return json({message:'Contraseña actualizada. Ingresá nuevamente con tu unidad.'});
  }
  return null;
}
