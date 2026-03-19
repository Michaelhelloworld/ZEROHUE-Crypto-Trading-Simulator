import React, { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router';
import DisclaimerModal from './components/modals/DisclaimerModal';
import PublicContentLayout from './components/layout/PublicContentLayout';
import { normalizePathname } from './utils/pathname';
import { safeStorage } from './utils/safeStorage';

const IntroView = React.lazy(() => import('./components/views/IntroView'));
const FAQView = React.lazy(() => import('./components/views/FAQView'));
const AboutView = React.lazy(() => import('./components/views/AboutView'));
const LearnHubView = React.lazy(() => import('./components/views/LearnHubView'));
const LearnArticleView = React.lazy(() => import('./components/views/LearnArticleView'));
const GlossaryHubView = React.lazy(() => import('./components/views/GlossaryHubView'));
const GlossaryEntryView = React.lazy(() => import('./components/views/GlossaryEntryView'));
const LegalView = React.lazy(() => import('./components/views/LegalView'));
const NotFoundView = React.lazy(() => import('./components/views/NotFoundView'));
const TerminalShell = React.lazy(() => import('./components/layout/TerminalShell'));

const isTerminalPath = (pathname: string) =>
  pathname === '/markets' ||
  pathname === '/portfolio' ||
  pathname === '/orders' ||
  pathname === '/history' ||
  pathname.startsWith('/trade/');

const isPublicContentPath = (pathname: string) =>
  pathname === '/' ||
  pathname === '/faq' ||
  pathname === '/about' ||
  pathname === '/learn' ||
  pathname === '/glossary' ||
  pathname.startsWith('/learn/') ||
  pathname.startsWith('/glossary/') ||
  pathname.startsWith('/legal/');

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

const AppRoutes: React.FC<{
  showDisclaimer: boolean;
  onAcceptDisclaimer: () => void;
}> = ({ showDisclaimer, onAcceptDisclaimer }) => {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const terminalRoute = isTerminalPath(pathname);
  const publicRoute = isPublicContentPath(pathname) || !terminalRoute;

  React.useEffect(() => {
    if (!publicRoute) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, publicRoute]);

  return (
    <>
      {terminalRoute && showDisclaimer && <DisclaimerModal onAccept={onAcceptDisclaimer} />}
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="/markets" element={<TerminalShell />} />
          <Route path="/portfolio" element={<TerminalShell />} />
          <Route path="/orders" element={<TerminalShell />} />
          <Route path="/history" element={<TerminalShell />} />
          <Route path="/trade/:coinId" element={<TerminalShell />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
};

export const AppContent: React.FC = () => {
  const [showDisclaimer, setShowDisclaimer] = React.useState(
    () => !safeStorage.getItem('zerohue_disclaimer_accepted')
  );

  const handleAcceptDisclaimer = () => {
    safeStorage.setItem('zerohue_disclaimer_accepted', 'true');
    setShowDisclaimer(false);
  };

  return (
    <>
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
      <AppRoutes showDisclaimer={showDisclaimer} onAcceptDisclaimer={handleAcceptDisclaimer} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
