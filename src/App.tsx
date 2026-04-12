import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
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
import { useApp } from './context/AppContext';

import './styles/global.css';

const MainContent = () => {
  const { state } = useApp();
  const { profile } = useAuth();
  return (
    <main className="main-content">
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

const AppShell = () => {
  const { isAuthModalOpen } = useAuth();
  return (
    <AppProvider>
      <div className="app-container">
        <Header />
        <CountdownWidget />
        <MainContent />

        <OnboardingModal />
        {isAuthModalOpen && <AuthModal />}
      </div>
    </AppProvider>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
};

export default App;

