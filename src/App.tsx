import { AppProvider } from './context/AppContext';
import { Header } from './components/layout/Header';
import { GroupView } from './components/group-stage/GroupView';
import { BracketTree } from './components/knockout-stage/BracketTree';
import { ThirdPlaceSelection } from './components/shared/ThirdPlaceSelection';
import { useApp } from './context/AppContext';
import './styles/global.css';

const MainContent = () => {
  const { state } = useApp();
  return (
    <main className="main-content">
      {state.activeTab === 'GROUP' ? <GroupView /> : <BracketTree />}
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
      </div>
    </AppProvider>
  );
};

export default App;
