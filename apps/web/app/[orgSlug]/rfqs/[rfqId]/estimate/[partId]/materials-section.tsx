"use client";

import { type MaterialCard, emptyCard } from "@/lib/quoting/materialCost";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type * as React from "react";
import { MaterialCard as MaterialCardItem } from "./material-card";

interface Props {
  quantities: number[];
  cards: MaterialCard[];
  setCards: React.Dispatch<React.SetStateAction<MaterialCard[]>>;
}

export function MaterialsSection({ quantities, cards, setCards }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addCard() {
    setCards((prev) => [...prev, { id: crypto.randomUUID(), ...emptyCard("sheet") }]);
  }

  function patchCard(id: string, patch: Partial<MaterialCard>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function copyCard(id: string) {
    setCards((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      const original = prev[index];
      if (!original) return prev;
      const next = [...prev];
      next.splice(index + 1, 0, { ...original, id: crypto.randomUUID() });
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCards((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900">Materials &amp; Parts</h2>
        <button
          type="button"
          onClick={addCard}
          aria-label="Add material"
          className="grid h-6 w-6 place-items-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <DndContext
        id="materials-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 space-y-3">
            {cards.map((card) => (
              <MaterialCardItem
                key={card.id}
                card={card}
                quantities={quantities}
                onChange={(patch) => patchCard(card.id, patch)}
                onDelete={() => deleteCard(card.id)}
                onCopy={() => copyCard(card.id)}
              />
            ))}
            {cards.length === 0 && (
              <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                No materials yet. Click + to add one.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
