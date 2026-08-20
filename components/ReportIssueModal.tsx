'use client';

import { useActionState, useState } from 'react';
import { reportService, type ReportServiceResult } from '../app/tilbyder/[id]/actions';
import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { Card } from './ui/Card';
import { label } from '../lib/ui';

type ReportIssueModalProps = {
  serviceId: string;
  serviceName: string;
  onClose: () => void;
};

const QUICK_REASONS = ['Nedlagt/stengt', 'Feil informasjon', 'Duplikat', 'Annet'];

type ReportFormState = ReportServiceResult;

const reportServiceAction = async (
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> => {
  const serviceId = String(formData.get('serviceId') ?? '');
  const reason = String(formData.get('reason') ?? '');
  return reportService(serviceId, reason);
};

export default function ReportIssueModal({
  serviceId,
  serviceName,
  onClose,
}: ReportIssueModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, action] = useActionState(reportServiceAction, { ok: false, message: '' });

  const combinedReason = [selectedReason, details.trim()].filter(Boolean).join(' — ');

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <Card className="w-full max-w-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Rapporter feil</h2>
            <p className="mt-1 text-sm text-slate-600">
              Si oss hva som er feil med «{serviceName}», så ser vi på det.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            aria-label="Lukk"
          >
            Lukk
          </button>
        </div>

        {!state.ok ? (
          <form className="mt-4 grid gap-3" action={action}>
            <input type="hidden" name="serviceId" value={serviceId} />
            <input type="hidden" name="reason" value={combinedReason} />
            <div className="grid gap-2">
              <span className={label}>Årsak</span>
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((reasonOption) => (
                  <button
                    key={reasonOption}
                    type="button"
                    onClick={() => setSelectedReason(reasonOption)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                    style={
                      selectedReason === reasonOption
                        ? { background: '#0F172A', color: '#fff' }
                        : { background: '#fff', border: '1px solid #E5E7EB', color: '#6B7280' }
                    }
                  >
                    {reasonOption}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="report-details" className={label}>
                Flere detaljer (valgfritt)
              </label>
              <Textarea
                id="report-details"
                rows={3}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Beskriv hva som er feil ..."
              />
            </div>
            {state.message && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {state.message}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!selectedReason}>
                Send rapport
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                Avbryt
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.message}
          </div>
        )}
      </Card>
    </div>
  );
}
