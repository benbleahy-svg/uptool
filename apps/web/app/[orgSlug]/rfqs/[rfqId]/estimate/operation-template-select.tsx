"use client";

import { useState } from "react";

export interface TemplateOption {
  id: string;
  name: string;
  operationType: string;
  defaultSetupMinutes: string;
  defaultRunMinutes: string;
  defaultHourlyRateCents: number;
  isRecentlyUsed: boolean;
}

interface Props {
  partId: string;
  templates: TemplateOption[];
  defaultRateEuros?: string;
  labels: {
    pickTemplate: string;
    recentlyUsed: string;
    all: string;
    manual: string;
    noTemplates: string;
    operationName: string;
    operationType: string;
    setupMin: string;
    runMin: string;
    hourlyRate: string;
    opTypeMachining: string;
    opTypeExpense: string;
    add: string;
  };
}

export function OperationTemplateSelect({ partId, templates, defaultRateEuros = "120.00", labels }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [opType, setOpType] = useState("machining");
  const [setup, setSetup] = useState("0");
  const [run, setRun] = useState("0");
  const [rate, setRate] = useState(defaultRateEuros);

  const isManual = selectedTemplateId === "__manual__";
  const recentlyUsed = templates.filter((t) => t.isRecentlyUsed);
  const rest = templates.filter((t) => !t.isRecentlyUsed);

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedTemplateId(val);
    if (val === "__manual__" || val === "") return;
    const tmpl = templates.find((t) => t.id === val);
    if (!tmpl) return;
    setName(tmpl.name);
    setOpType(tmpl.operationType);
    setSetup(tmpl.defaultSetupMinutes);
    setRun(tmpl.defaultRunMinutes);
    setRate(String((tmpl.defaultHourlyRateCents / 100).toFixed(2)));
  }

  return (
    <div className="space-y-3">
      {/* Hidden field for templateId so the server action can record usage */}
      <input type="hidden" name="templateId" value={selectedTemplateId === "__manual__" ? "" : selectedTemplateId} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="operationType" value={opType} />
      <input type="hidden" name="setupMinutes" value={setup} />
      <input type="hidden" name="runMinutes" value={run} />
      <input type="hidden" name="hourlyRateEuros" value={rate} />

      {/* Template picker */}
      {templates.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{labels.noTemplates}</p>
      ) : (
        <div>
          <label htmlFor={`${partId}-tmpl-pick`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {labels.pickTemplate}
          </label>
          <select
            id={`${partId}-tmpl-pick`}
            value={selectedTemplateId}
            onChange={handleTemplateChange}
            className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            <option value="">—</option>
            {recentlyUsed.length > 0 && (
              <optgroup label={labels.recentlyUsed}>
                {recentlyUsed.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.operationType === "expense" ? "$ " : "⏱ "}
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {rest.length > 0 && (
              <optgroup label={labels.all}>
                {rest.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.operationType === "expense" ? "$ " : "⏱ "}
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="">
              <option value="__manual__">{labels.manual}</option>
            </optgroup>
          </select>
        </div>
      )}

      {/* Pre-filled preview or manual entry fields */}
      {(selectedTemplateId !== "" && !isManual) && (
        <div className="grid grid-cols-4 gap-2 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.3)] rounded p-2">
          <span>{labels.operationType}: <strong>{opType === "expense" ? labels.opTypeExpense : labels.opTypeMachining}</strong></span>
          <span>{labels.setupMin}: <strong>{setup}</strong></span>
          <span>{labels.runMin}: <strong>{run}</strong></span>
          <span>{labels.hourlyRate}: <strong>€{rate}/h</strong></span>
        </div>
      )}

      {/* Manual entry fields */}
      {(isManual || templates.length === 0) && (
        <div className="grid grid-cols-5 gap-2">
          <div>
            <label htmlFor={`${partId}-m-type`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.operationType}
            </label>
            <select
              id={`${partId}-m-type`}
              value={opType}
              onChange={(e) => setOpType(e.target.value)}
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="machining">{labels.opTypeMachining}</option>
              <option value="expense">{labels.opTypeExpense}</option>
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor={`${partId}-m-name`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.operationName}
            </label>
            <input
              id={`${partId}-m-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="CNC Milling"
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label htmlFor={`${partId}-m-setup`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.setupMin}
            </label>
            <input
              id={`${partId}-m-setup`}
              type="number"
              min="0"
              step="0.5"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label htmlFor={`${partId}-m-run`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.runMin}
            </label>
            <input
              id={`${partId}-m-run`}
              type="number"
              min="0"
              step="0.5"
              value={run}
              onChange={(e) => setRun(e.target.value)}
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="col-span-5 grid grid-cols-5 gap-2">
            <div>
              <label htmlFor={`${partId}-m-rate`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                {labels.hourlyRate} (€)
              </label>
              <input
                id={`${partId}-m-rate`}
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
