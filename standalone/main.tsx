import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Home runtime={{apiPath:'/api/pilot',loginPath:'/auth/google',logoutPath:'/auth/logout',authLabel:'Google'}}/></React.StrictMode>);
