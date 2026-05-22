import React, { useMemo } from 'react';
import type { Team } from '../../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableGroupProps {
  group: string;
  teams: Team[];
  onReorder: (order: string[]) => void;
}

const SortableItem: React.FC<{ team: Team; index: number }> = ({ team, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`sortable-row ${isDragging ? 'dragging' : ''}`}
    >
      <td className="pos-col">{index + 1}</td>
      <td className="drag-handle-col">
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${team.name}`}
        >
          ⠿
        </button>
      </td>
      <td className="flag-col">
        <img
          src={`${import.meta.env.BASE_URL}flags/${team.code}.svg`}
          alt={team.code}
          className="team-flag"
        />
      </td>
      <td className="name-col">
        <span className="team-name full">{team.name}</span>
        <span className="team-name abbr">{team.code}</span>
      </td>
    </tr>
  );
};

export const SortableGroup: React.FC<SortableGroupProps> = ({
  group,
  teams,
  onReorder,
}) => {
  const teamIds = useMemo(() => teams.map(t => t.id), [teams]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = teamIds.indexOf(active.id as string);
      const newIndex = teamIds.indexOf(over.id as string);
      onReorder(arrayMove(teamIds, oldIndex, newIndex));
    }
  };

  return (
    <div className="sortable-group glass-panel">
      <h3 className="sortable-group-title">Group {group}</h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={teamIds}
          strategy={verticalListSortingStrategy}
        >
          <table className="group-positions-table">
            <thead>
              <tr>
                <th className="pos-col">#</th>
                <th className="drag-col"></th>
                <th className="flag-col"></th>
                <th className="name-col">Team</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => (
                <SortableItem key={team.id} team={team} index={index} />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
};
