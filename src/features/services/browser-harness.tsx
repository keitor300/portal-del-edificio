import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PortalProvider } from '../../hooks/usePortal';
import { NoticesPage, NoticeDetail } from '../notices/Notices';
import { AdminServicesPage, ChatPage, ContactsPage, IssuesPage, ServicesPage, SumPage, UrgenciesPage } from './index';

const routes = [
  ['/servicios', <ServicesPage />],
  ['/servicios/sum', <SumPage />],
  ['/servicios/reclamos', <IssuesPage />],
  ['/servicios/chat', <ChatPage />],
  ['/servicios/contactos', <ContactsPage />],
  ['/servicios/urgencias', <UrgenciesPage />],
  ['/admin/servicios', <AdminServicesPage />],
  ['/demo/propietario/novedades', <NoticesPage />],
  ['/demo/propietario/novedades/:id', <NoticeDetail context="owner" />],
  ['/demo/administracion/comunicaciones', <NoticesPage admin />],
  ['/demo/administracion/comunicaciones/:id', <NoticeDetail context="admin" />],
] as const;

createRoot(document.getElementById('root')!).render(<PortalProvider><BrowserRouter><Routes>{routes.map(([path, element]) => <Route key={path} path={path} element={element} />)}</Routes></BrowserRouter></PortalProvider>);
