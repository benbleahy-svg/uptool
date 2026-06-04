"use client";

import type { Operation, OperationType } from "@/lib/quoting/operationCost";
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
import { AddOperationPopover } from "./add-operation-popover";
import { OperationRow } from "./operation-row";

/** Map a popover entry name to a client operation type. Unknown names (most of
 *  the catalogue) fall back to a generic time-based op, which persists cleanly. */
export function resolveType(name: string): OperationType {
  switch (name) {
    case "Programming":
      return "programming";
    case "Deburr":
      return "deburr";
    case "Bending":
      return "bending";
    case "Inspection":
      return "inspection";
    case "CNC Milling":
      return "cnc-milling";
    case "Pack and Ship":
      return "pack-and-ship";
    default:
      return "generic";
  }
}

interface Props {
  quantities: number[];
  operations: Operation[];
  onAdd: (name: string) => void;
  onPatch: (id: string, patch: Partial<Operation>) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function OperationsSection({
  quantities,
  operations,
  onAdd,
  onPatch,
  onDelete,
  onCopy,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = operations.findIndex((o) => o.id === active.id);
    const newIndex = operations.findIndex((o) => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(operations, oldIndex, newIndex).map((o) => o.id));
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900">Operations</h2>
        <AddOperationPopover
          onAdd={onAdd}
          align="start"
          trigger={
            <button
              type="button"
              aria-label="Add operation"
              className="grid h-6 w-6 place-items-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        />
      </div>

      <DndContext
        id="operations-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={operations.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 space-y-3">
            {operations.map((op) => (
              <OperationRow
                key={op.id}
                op={op}
                quantities={quantities}
                onChange={(patch) => onPatch(op.id, patch)}
                onDelete={() => onDelete(op.id)}
                onCopy={() => onCopy(op.id)}
              />
            ))}
            {operations.length === 0 && (
              <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                No operations yet. Click + to add one.
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
