import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { GroupView } from './components/group-stage/GroupView';
import { BracketTree } from './components/knockout-stage/BracketTree';
import { ThirdPlaceSelection } from './components/shared/ThirdPlaceSelection';
import { OnboardingModal } from './components/shared/OnboardingModal';
import { AwardsView } from './components/awards/AwardsView';
import { SummaryView } from './components/summary/SummaryView';
import { TournamentXIView } from './components/tournament-xi/TournamentXIView';
import { AuthModal } from './components/auth/AuthModal';
import { AdminView } from './components/admin/AdminView';
import { CountdownWidget } from './components/shared/CountdownWidget';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { EredivisieTestView } from './components/eredivisie/EredivisieTestView';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/Toast';
import { useApp } from './context/AppContext';
import { useLoadUserPredictions } from './hooks/useLoadUserPredictions';

import './styles/global.css';

const MainContent = () => {
  const { state } = useApp();
  const { profile, isTestModeEnabled } = useAuth();
  return (
    <main className="main-content">
      {isTestModeEnabled && state.activeTab === 'EREDIVISIE_TEST' && <EredivisieTestView />}
      {state.activeTab === 'GROUP'         && <GroupView />}
      {state.activeTab === 'BRACKET'       && <BracketTree />}
      {state.activeTab === 'AWARDS'        && <AwardsView />}
      {state.activeTab === 'TOURNAMENT_XI' && <TournamentXIView />}
      {state.activeTab === 'SUMMARY'       && <SummaryView />}
      {state.activeTab === 'LEADERBOARD'   && <LeaderboardView />}
      {state.activeTab === 'ADMIN' && profile?.is_master && <AdminView />}
      <ThirdPlaceSelection />
    </main>
  );
};

const AppContentWrapper = () => {
  useLoadUserPredictions();
  return (
    <div className="app-container">
      <Header />
      <CountdownWidget />
      <MainContent />
    </div>
  );
};

const AppShell = () => {
  const { isAuthModalOpen } = useAuth();
  return (
    <AppProvider>
      <ErrorBoundary>
        <AppContentWrapper />
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

