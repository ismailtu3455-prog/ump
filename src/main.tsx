import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import './index.css';

const App = lazy(() => import('./App'));
const isRussianLocale = navigator.language.toLowerCase().startsWith('ru');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <Suspense
        fallback={
          <div className="boot-loader">
            <div className="boot-loader__pulse" />
            <p>{isRussianLocale ? 'Загрузка Universal Media Player...' : 'Loading Universal Media Player...'}</p>
          </div>
        }
      >
        <App />
      </Suspense>
    </Provider>
  </React.StrictMode>
);

