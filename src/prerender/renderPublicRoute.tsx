/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Toaster } from 'react-hot-toast';
import { Route, Routes, StaticRouter } from 'react-router';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PublicContentLayout from '../components/layout/PublicContentLayout';
import AboutView from '../components/views/AboutView';
import FAQView from '../components/views/FAQView';
import GlossaryEntryView from '../components/views/GlossaryEntryView';
import GlossaryHubView from '../components/views/GlossaryHubView';
import IntroView from '../components/views/IntroView';
import LearnArticleView from '../components/views/LearnArticleView';
import LearnHubView from '../components/views/LearnHubView';
import LegalView from '../components/views/LegalView';
import NotFoundView from '../components/views/NotFoundView';

const RouteFallback: React.FC = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-[#020617] text-slate-300">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
      <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-slate-500">
        Loading
      </div>
    </div>
  </div>
);

const PublicContentPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PublicContentLayout>{children}</PublicContentLayout>
);

const PrerenderRoutes: React.FC = () => (
  <React.Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<IntroView />} />
      <Route
        path="/faq"
        element={
          <PublicContentPage>
            <FAQView />
          </PublicContentPage>
        }
      />
      <Route
        path="/about"
        element={
          <PublicContentPage>
            <AboutView />
          </PublicContentPage>
        }
      />
      <Route
        path="/learn"
        element={
          <PublicContentPage>
            <LearnHubView />
          </PublicContentPage>
        }
      />
      <Route
        path="/learn/:slug"
        element={
          <PublicContentPage>
            <LearnArticleView />
          </PublicContentPage>
        }
      />
      <Route
        path="/glossary"
        element={
          <PublicContentPage>
            <GlossaryHubView />
          </PublicContentPage>
        }
      />
      <Route
        path="/glossary/:slug"
        element={
          <PublicContentPage>
            <GlossaryEntryView />
          </PublicContentPage>
        }
      />
      <Route path="/legal/:type" element={<LegalView />} />
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  </React.Suspense>
);

export const renderPublicRoute = (routePath: string) =>
  renderToString(
    <React.StrictMode>
      <ErrorBoundary>
        <StaticRouter location={routePath}>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
            }}
          />
          <PrerenderRoutes />
        </StaticRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
