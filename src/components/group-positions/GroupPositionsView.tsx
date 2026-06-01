import React from 'react';
import { useApp } from '../../context/AppContext';
import { groups, initialTeams, getDefaultGroupPositions } from '../../utils/data-init';
import { supabase } from '../../lib/supabase';
import { SortableGroup } from './SortableGroup';
import './GroupPositionsView.css';

export const GroupPositionsView: React.FC = () => {
  const { state, updateGroupPosition, autoFillGroupPositions, setGroupPositions } = useApp();
  const { customGroupPositions } = state;

  const handleReset = async () => {
    if (confirm('Reset all group positions to default order? This will also clear your knockout bracket.')) {
      const defaults = getDefaultGroupPositions();
      setGroupPositions(defaults);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_group_positions').delete().eq('user_id', user.id);
        try {
          await supabase.from('user_predictions_knockout_structure').delete().eq('user_id', user.id);
        } catch (_) { /* table may not exist yet */ }
      }
    }
  };

  const handleAutoFill = () => {
    if (confirm('Randomly shuffle all group positions?')) {
      autoFillGroupPositions();
    }
  };

  return (
    <div className="group-positions-view fade-in">
      <header className="group-positions-header glass-panel">
        <h2 className="text-gradient">Group Positions</h2>
        <p>Drag teams to predict the final ranking for each group.</p>
        <div className="group-positions-actions">
          <button className="gp-btn gp-autofill-btn" onClick={handleAutoFill}>
            🎲 Auto-Fill
          </button>
          <button className="gp-btn gp-reset-btn" onClick={handleReset}>
            🔄 Reset
          </button>
        </div>
      </header>

      <div className="group-positions-grid">
        {groups.map(group => (
          <SortableGroup
            key={group}
            group={group}
            teams={
              customGroupPositions[group]?.map(id =>
                initialTeams.find(t => t.id === id)!
              ) ?? initialTeams.filter(t => t.group === group)
            }
            onReorder={(order) => updateGroupPosition(group, order)}
          />
        ))}
      </div>
    </div>
  );
};
