# Owner access demo

Creative Gate closed: extend the existing forest, ivory and pastel visual system with a focused mobile login, registration and approval queue. Use existing typography, icons and form controls. No generated media. Main journey: public SUM/owner link opens a new tab, a prominent first-time panel explains that new residents must request access, registration captures name, email, unit and password, administrator reviews the unit and email, and the approved owner signs in with unit and password before returning to the intended section. The portal does not request or expose DNI.

This is explicitly a local demonstration requested by the user. Accounts and approvals are local to the browser. Passwords use salted PBKDF2 hashes; this does not make browser-controlled authorization a production security boundary. Use fictitious identity data. The existing administrator demo remains open and admin/admin is demo-only.

Production requires server-side authentication and authorization, shared storage, private identity handling, verified administrator access, and server-authoritative reservations and unit ownership. Demo portal records still remain browser-local.
