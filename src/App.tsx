import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { GroupView } from './components/group-stage/GroupView';
import { GroupPositionsView } from './components/group-positions/GroupPositionsView';
import { BracketTree } from './components/knockout-stage/BracketTree';
import { ThirdPlaceSelection } from './components/shared/ThirdPlaceSelection';
import { OnboardingModal } from './components/shared/OnboardingModal';
import { TutorialOverlay } from './components/shared/TutorialOverlay';
import { AwardsView } from './components/awards/AwardsView';
import { SummaryView } from './components/summary/SummaryView';

import { AuthModal } from './components/auth/AuthModal';
import { AdminView } from './components/admin/AdminView';
import { CountdownWidget } from './components/shared/CountdownWidget';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { GamesView } from './components/games/GamesView';
import { FloatingSaveButton } from './components/shared/FloatingSaveButton';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/Toast';
import { useApp } from './context/AppContext';
import { useLoadUserPredictions } from './hooks/useLoadUserPredictions';
import { useLoadOfficialMatches } from './hooks/useLoadOfficialMatches';

import './styles/global.css';

const MainContent = () => {
  const { state } = useApp();
  const { profile } = useAuth();
  return (
    <main className="main-content">
      {state.activeTab === 'GAMES'         && <GamesView />}
      {state.activeTab === 'GROUP_DEP'        && <GroupView />}
      {state.activeTab === 'GROUP_POSITIONS'  && <GroupPositionsView />}
      {state.activeTab === 'BRACKET'       && <BracketTree />}
      {state.activeTab === 'AWARDS'        && <AwardsView />}
      {state.activeTab === 'SUMMARY'       && <SummaryView />}
      {state.activeTab === 'LEADERBOARD'   && <LeaderboardView />}
      {state.activeTab === 'ADMIN' && profile?.is_master && <AdminView />}
    </main>
  );
};

const AppContentWrapper = () => {
  useLoadUserPredictions();
  useLoadOfficialMatches();
  return (
    <div className="app-container">
      <Header />
      <CountdownWidget />
      <MainContent />
      <FloatingSaveButton />
      <MobileBottomNav />
    </div>
  );
};

const AppShell = () => {
  const { isAuthModalOpen } = useAuth();
  return (
    <AppProvider>
      <ErrorBoundary>
        <AppContentWrapper />
        <ThirdPlaceSelection />
        <TutorialOverlay />
        <OnboardingModal />
        {isAuthModalOpen && <AuthModal />}
      </ErrorBoundary>
    </AppProvider>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;

