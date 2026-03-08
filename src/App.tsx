import { AppProvider } from './context/AppContext';
import { Header } from './components/layout/Header';
import { GroupView } from './components/group-stage/GroupView';
import { BracketTree } from './components/knockout-stage/BracketTree';
import { ThirdPlaceSelection } from './components/shared/ThirdPlaceSelection';
import { OnboardingModal } from './components/shared/OnboardingModal';
import { AwardsView } from './components/awards/AwardsView';
import { SummaryView } from './components/summary/SummaryView';
import { TournamentXIView } from './components/tournament-xi/TournamentXIView';
import { useApp } from './context/AppContext';
import './styles/global.css';

const MainContent = () => {
  const { state } = useApp();
  return (
    <main className="main-content">
      {state.activeTab === 'GROUP' && <GroupView />}
      {state.activeTab === 'BRACKET' && <BracketTree />}
      {state.activeTab === 'AWARDS' && <AwardsView />}
      {state.activeTab === 'TOURNAMENT_XI' && <TournamentXIView />}
      {state.activeTab === 'SUMMARY' && <SummaryView />}
      <ThirdPlaceSelection />
    </main>
  );
};

const App = () => {
  return (
    <AppProvider>
      <div className="app-container">
        <Header />
        <MainContent />
        <OnboardingModal />
      </div>
    </AppProvider>
  );
};

export default App;
