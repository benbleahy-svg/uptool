"use client";

import { type Operation, type OperationType, createOperation } from "@/lib/quoting/operationCost";
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
import { AddOperationPopover } from "./add-operation-popover";
import { OperationRow } from "./operation-row";

function resolveType(name: string): OperationType {
  switch (name) {
    case "Programming":
      return "programming";
    case "Laser Cutting":
      return "laser-cutting";
    case "Deburr":
      return "deburr";
    case "Bending":
      return "bending";
    case "Finishing (new)":
      return "finishing";
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

// Seed ops mirror 0_0: a mix of incomplete (red) and complete (priced) rows.
export function seedOperations(partArea: number): Operation[] {
  const laser = createOperation("laser-cutting");
  laser.fields = {
    material: "AS A36",
    thickness: "0,12",
    cutSpeed: "300",
    pierceTime: "1",
    cutLength: "55,09",
    pierces: "43",
    setupTime: "5",
    cycleTime: "0,9",
    laserType: "fiber",
  };
  const deburr = createOperation("deburr");
  deburr.fields = { setupTime: "0", runTime: "5" };
  const finishing = createOperation("finishing", { partArea });
  finishing.fields = {
    finishingProcess: "anodize",
    minBatch: "100",
    cost: "0,12",
    partArea: partArea.toLocaleString("de-DE", { maximumFractionDigits: 2 }),
  };

  return [
    { id: "op-1", ...createOperation("programming") },
    { id: "op-2", ...laser },
    { id: "op-3", ...deburr },
    { id: "op-4", ...createOperation("bending") },
    { id: "op-5", ...finishing },
  ];
}

interface Props {
  quantities: number[];
  partAreaCm2: number;
  operations: Operation[];
  setOperations: React.Dispatch<React.SetStateAction<Operation[]>>;
}

export function OperationsSection({ quantities, partAreaCm2, operations, setOperations }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addOp(name: string) {
    const base = createOperation(resolveType(name), { name, partArea: partAreaCm2 });
    setOperations((prev) => [...prev, { id: crypto.randomUUID(), ...base }]);
  }

  function patchOp(id: string, patch: Partial<Operation>) {
    setOperations((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function deleteOp(id: string) {
    setOperations((prev) => prev.filter((o) => o.id !== id));
  }

  function copyOp(id: string) {
    setOperations((prev) => {
      const index = prev.findIndex((o) => o.id === id);
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
    setOperations((prev) => {
      const oldIndex = prev.findIndex((o) => o.id === active.id);
      const newIndex = prev.findIndex((o) => o.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900">Operations</h2>
        <AddOperationPopover
          onAdd={addOp}
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
                onChange={(patch) => patchOp(op.id, patch)}
                onDelete={() => deleteOp(op.id)}
                onCopy={() => copyOp(op.id)}
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
