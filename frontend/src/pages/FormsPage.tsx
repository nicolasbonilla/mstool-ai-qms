import { useEffect, useState } from 'react';
import {
  FileText, Plus, Download, PenTool, CheckCircle2,
  Trash2, Search, Edit, Clock, CheckCircle, Save,
  ArrowRight, ShieldCheck, Code, TestTube2, AlertTriangle, FileCheck,
} from 'lucide-react';
import apiClient from '../api/client';

/* ─── Types ─── */
interface FormTemplate { template_id: string; title: string; standard: string }
interface FormRecord {
  id: string; template_id: string; title: string; status: string; version: number;
  created_by: string; created_at: string; updated_at: string;
  fields: Record<string, string>; signatures: { user: string; role: string; signed_at: string }[];
  // Forms drafted by the Autonomous Gap-Closer agent carry source metadata
  source?: string;
  source_meta?: { gap_key?: string; estimated_score_lift?: string; drafted_by_model?: string };
}
interface TemplateField { name: string; label: string; field_type: string; required: boolean; options?: string[]; section: string; help_text?: string }

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string; next: string }> = {
  draft: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: Edit, label: 'Draft', next: 'Complete and submit for review' },
  in_review: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: Clock, label: 'In Review', next: 'Awaiting approval' },
  approved: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle, label: 'Approved', next: 'Audit-ready' },
  superseded: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: AlertTriangle, label: 'Superseded', next: 'Replaced by newer version' },
};

/* Template descriptions for the guidance panel */
const TEMPLATE_GUIDE = [
  { id: 'TPL-01', title: 'Problem Report', clause: 'IEC 62304 §9', role: 'Developer', icon: AlertTriangle, desc: 'Document bugs, root cause, and corrective actions' },
  { id: 'TPL-02', title: 'Release Checklist', clause: 'IEC 62304 §5.8', role: 'QMS Manager', icon: FileCheck, desc: 'Verify all deliverables before release' },
  { id: 'TPL-03', title: 'Code Review', clause: 'IEC 62304 §5.5.3', role: 'Developer', icon: Code, desc: 'Review code for Class C compliance' },
  { id: 'TPL-04', title: 'Risk Verification', clause: 'ISO 14971 §7.4', role: 'QA', icon: ShieldCheck, desc: 'Verify risk control measures are effective' },
  { id: 'TPL-06', title: 'Test Report', clause: 'IEC 62304 §5.5.5', role: 'QA', icon: TestTube2, desc: 'Record test execution and results' },
  { id: 'TPL-07', title: 'SOUP Review', clause: 'IEC 81001-5-1 §5.3.12', role: 'Security', icon: ShieldCheck, desc: 'Monthly dependency vulnerability review' },
];

/* ═══════════════════════════════════════════════════════
   FORMS PAGE — 3-Level Information Architecture

   Level 1: Status — "How many forms need attention?"
   Level 2: Form list grouped by status + editor/guidance panel
   Level 3: Form field editor with sections

   Based on:
   - Enterprise workflow patterns (list + detail split panel)
   - Progressive disclosure (collapsed list → expanded editor)
   - Role-based guidance (which template to use)
   ═══════════════════════════════════════════════════════ */
export default function FormsPage() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormRecord | null>(null);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [tRes, fRes] = await Promise.all([apiClient.get('/forms/templates'), apiClient.get('/forms/')]);
      setTemplates(tRes.data.templates || []); setForms(fRes.data.forms || []);
    } catch { /* */ } finally { setLoading(false); }
  };

  const createForm = async (templateId: string) => {
    const { data } = await apiClient.post('/forms/', { template_id: templateId });
    setForms(prev => [data, ...prev]); setSelectedForm(data); setShowCreate(false);
    loadTemplateFields(templateId);
  };

  const loadTemplateFields = async (templateId: string) => {
    try { const { data } = await apiClient.get(`/forms/templates/${templateId}/fields`); setTemplateFields(data.fields || []); }
    catch { setTemplateFields([]); }
  };

  const selectForm = async (form: FormRecord) => { setSelectedForm(form); await loadTemplateFields(form.template_id); };
  const updateField = (name: string, value: string) => { if (!selectedForm) return; setSelectedForm({ ...selectedForm, fields: { ...selectedForm.fields, [name]: value } }); };

  const saveForm = async () => {
    if (!selectedForm) return; setSaving(true);
    try { const { data } = await apiClient.put(`/forms/${selectedForm.id}`, { fields: selectedForm.fields }); setSelectedForm(data); setForms(prev => prev.map(f => f.id === data.id ? data : f)); }
    catch { /* */ } setSaving(false);
  };

  const signForm = async () => { if (!selectedForm) return; const { data } = await apiClient.post(`/forms/${selectedForm.id}/sign`); setSelectedForm(data); setForms(prev => prev.map(f => f.id === data.id ? data : f)); };
  const approveForm = async () => { if (!selectedForm) return; const { data } = await apiClient.post(`/forms/${selectedForm.id}/approve`); setSelectedForm(data); setForms(prev => prev.map(f => f.id === data.id ? data : f)); };
  const deleteForm = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (!confirm('Delete this form?')) return; await apiClient.delete(`/forms/${id}`); setForms(prev => prev.filter(f => f.id !== id)); if (selectedForm?.id === id) setSelectedForm(null); };
  const downloadPDF = async () => { if (!selectedForm) return; try { const { data } = await apiClient.get(`/forms/${selectedForm.id}/pdf`, { responseType: 'blob' }); const url = window.URL.createObjectURL(new Blob([data])); const a = document.createElement('a'); a.href = url; a.download = `${selectedForm.template_id}_${selectedForm.id}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch { /* */ } };

  const draftCount = forms.filter(f => f.status === 'draft').length;
  const reviewCount = forms.filter(f => f.status === 'in_review').length;
  const approvedCount = forms.filter(f => f.status === 'approved').length;
  const filteredForms = forms.filter(f => {
    if (filterStatus && f.status !== filterStatus) return false;
    if (searchQuery && !f.title.toLowerCase().includes(searchQuery.toLowerCase()) && !f.id.includes(searchQuery)) return false;
    return true;
  });

  // Group fields by section
  const sections = templateFields.reduce<Record<string, TemplateField[]>>((acc, field) => {
    const s = field.section || 'General'; if (!acc[s]) acc[s] = []; acc[s].push(field); return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 rounded-full border-[3px] border-teal/20 border-t-teal animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════
          LEVEL 1 — STATUS BANNER
          "How many forms need attention?"
          ═══════════════════════════════════════ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: draftCount > 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))' : forms.length === 0 ? 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(14,165,233,0.03))' : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
          border: `1px solid ${draftCount > 0 ? 'rgba(245,158,11,0.15)' : forms.length === 0 ? 'rgba(14,165,233,0.15)' : 'rgba(16,185,129,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.12)' }}>
            <FileText size={24} style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Regulatory Forms</span>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Evidence records required by IEC 62304 for CE Mark audit
            </p>
            <div className="flex items-center gap-3 mt-1">
              {forms.length > 0 && <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{forms.length} form{forms.length !== 1 ? 's' : ''}</span>}
              {draftCount > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#F59E0B' }}><span className="w-2 h-2 rounded-full bg-amber-400" />{draftCount} draft{draftCount > 1 ? 's' : ''} — needs completion</span>}
              {reviewCount > 0 && <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}><span className="w-2 h-2 rounded-full bg-amber-400" />{reviewCount} in review</span>}
              {approvedCount > 0 && <span className="flex items-center gap-1 text-[11px]" style={{ color: '#10B981' }}><span className="w-2 h-2 rounded-full bg-emerald-500" />{approvedCount} approved</span>}
            </div>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-white px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
          <Plus size={15} /> New Form
        </button>
      </div>

      {/* Template selector dropdown */}
      {showCreate && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Select Template</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <button key={t.template_id} onClick={() => createForm(t.template_id)}
                className="text-left p-3 rounded-xl transition-all duration-150 group"
                style={{ border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>{t.template_id}</code>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t.standard}</span>
                </div>
                <p className="text-[12px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEVEL 2 — FORM LIST + EDITOR/GUIDANCE
          ═══════════════════════════════════════ */}
      <div className="flex gap-5" style={{ height: 'calc(100vh - 14rem)' }}>

        {/* Left: Form List */}
        <div className="w-[380px] flex flex-col shrink-0">
          {/* Search + filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search forms..." className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl transition-all"
                style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)' }} />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="text-[12px] font-medium rounded-xl px-3 py-2 transition-all"
              style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)' }}>
              <option value="">All status</option>
              <option value="draft">Draft</option>
              <option value="in_review">Review</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          {/* Form cards */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredForms.map((form) => {
              const cfg = STATUS_CONFIG[form.status] || STATUS_CONFIG.draft;
              const isSelected = selectedForm?.id === form.id;
              return (
                <div key={form.id} onClick={() => selectForm(form)}
                  className="p-3.5 rounded-xl cursor-pointer transition-all duration-200"
                  style={{
                    background: isSelected ? 'var(--bg-tertiary)' : 'var(--card-bg)',
                    border: `1px solid ${isSelected ? 'rgba(14,165,233,0.3)' : 'var(--card-border)'}`,
                    boxShadow: isSelected ? '0 4px 12px rgba(14,165,233,0.08)' : 'var(--card-shadow)',
                  }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>{form.template_id}</code>
                      {form.source === 'autonomous_gap_closer' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                          style={{ background: 'rgba(236,72,153,0.12)', color: '#EC4899' }}
                          title={`Drafted by AI (${form.source_meta?.drafted_by_model || 'Claude'}) — needs human review${form.source_meta?.gap_key ? ` · closes gap: ${form.source_meta.gap_key}` : ''}`}>
                          ✨ AI-drafted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        <cfg.icon size={9} /> {cfg.label}
                      </span>
                      <button onClick={(e) => deleteForm(form.id, e)} className="opacity-30 hover:opacity-100 hover:text-red-500 transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{form.title}</p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    {form.created_by || 'Unknown'} · {form.created_at ? new Date(form.created_at).toLocaleDateString() : ''}
                    {form.signatures.length > 0 && <span> · {form.signatures.length} signature{form.signatures.length > 1 ? 's' : ''}</span>}
                    {form.source === 'autonomous_gap_closer' && form.source_meta?.estimated_score_lift && (
                      <span> · estimated lift {form.source_meta.estimated_score_lift}</span>
                    )}
                  </p>
                  {/* Workflow hint */}
                  <p className="text-[9px] font-medium mt-1.5" style={{ color: cfg.color }}>{cfg.next}</p>
                </div>
              );
            })}

            {filteredForms.length === 0 && forms.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <FileText size={24} style={{ color: '#0EA5E9' }} />
                </div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>No forms yet</p>
                <p className="text-[11px] mt-1 max-w-[250px]" style={{ color: 'var(--text-muted)' }}>Create your first form to start building audit evidence</p>
                <button onClick={() => setShowCreate(true)} className="text-[12px] font-semibold mt-3 px-4 py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                  + New Form
                </button>
              </div>
            )}

            {filteredForms.length === 0 && forms.length > 0 && (
              <p className="text-[12px] text-center py-8" style={{ color: 'var(--text-muted)' }}>No forms match this filter</p>
            )}
          </div>
        </div>

        {/* Right: Editor or Guidance */}
        <div className="flex-1 overflow-y-auto">
          {selectedForm ? (
            /* ═══════════════════════════════════
               LEVEL 3 — FORM EDITOR
               ═══════════════════════════════════ */
            <div className="rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
              {/* Header */}
              <div className="p-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-[12px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>{selectedForm.template_id}</code>
                      {(() => { const cfg = STATUS_CONFIG[selectedForm.status] || STATUS_CONFIG.draft; return (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1" style={{ background: cfg.bg, color: cfg.color }}>
                          <cfg.icon size={9} /> {cfg.label}
                        </span>
                      ); })()}
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>v{selectedForm.version}</span>
                    </div>
                    <h2 className="text-[18px] font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{selectedForm.title}</h2>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      ID: {selectedForm.id} · Created: {selectedForm.created_at ? new Date(selectedForm.created_at).toLocaleString() : ''} · By: {selectedForm.created_by || 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={downloadPDF} className="text-[11px] font-semibold px-3 py-2 rounded-xl transition-all" style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                      <Download size={12} className="inline mr-1" /> PDF
                    </button>
                    <button onClick={signForm} className="text-[11px] font-semibold px-3 py-2 rounded-xl transition-all" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                      <PenTool size={12} className="inline mr-1" /> Sign
                    </button>
                    {selectedForm.status !== 'approved' && (
                      <button onClick={approveForm} className="text-[11px] font-semibold px-3 py-2 rounded-xl transition-all" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                        <CheckCircle2 size={12} className="inline mr-1" /> Approve
                      </button>
                    )}
                    <button onClick={saveForm} disabled={saving}
                      className="text-[11px] font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                      <Save size={12} className="inline mr-1" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Workflow stepper */}
                <div className="flex items-center gap-2 mt-4">
                  {['draft', 'in_review', 'approved'].map((step, i) => {
                    const cfg = STATUS_CONFIG[step];
                    const isCurrent = selectedForm.status === step;
                    const isPast = ['draft', 'in_review', 'approved'].indexOf(selectedForm.status) > i;
                    return (
                      <div key={step} className="flex items-center gap-2">
                        {i > 0 && <div className="w-8 h-0.5 rounded-full" style={{ background: isPast ? '#10B981' : 'var(--border-default)' }} />}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                          style={{ background: isCurrent ? cfg.bg : 'transparent', color: isCurrent ? cfg.color : isPast ? '#10B981' : 'var(--text-muted)' }}>
                          {isPast ? <CheckCircle size={10} /> : <cfg.icon size={10} />} {cfg.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fields */}
              <div className="p-5 space-y-6">
                {Object.keys(sections).length > 0 ? (
                  Object.entries(sections).map(([sectionName, fields]) => (
                    <div key={sectionName}>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {sectionName}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {fields.map((field) => (
                          <div key={field.name} className={field.field_type === 'textarea' ? 'col-span-2' : ''}>
                            <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                              {field.label}{field.required && <span style={{ color: '#EF4444' }}> *</span>}
                            </label>
                            {field.help_text && <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{field.help_text}</p>}
                            {field.field_type === 'textarea' ? (
                              <textarea value={selectedForm.fields[field.name] || ''} onChange={(e) => updateField(field.name, e.target.value)}
                                rows={3} className="w-full rounded-xl px-3.5 py-2.5 text-[13px] transition-all resize-none"
                                style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)' }} />
                            ) : field.field_type === 'select' ? (
                              <select value={selectedForm.fields[field.name] || ''} onChange={(e) => updateField(field.name, e.target.value)}
                                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] transition-all"
                                style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)' }}>
                                <option value="">Select...</option>
                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : field.field_type === 'checkbox' ? (
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={selectedForm.fields[field.name] === 'true'} onChange={(e) => updateField(field.name, String(e.target.checked))} />
                                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Yes</span>
                              </label>
                            ) : (
                              <input type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
                                value={selectedForm.fields[field.name] || ''} onChange={(e) => updateField(field.name, e.target.value)}
                                className="w-full rounded-xl px-3.5 py-2.5 text-[13px] transition-all"
                                style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading template fields...</p>
                )}

                {/* Signatures */}
                {selectedForm.signatures.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      Electronic Signatures ({selectedForm.signatures.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedForm.signatures.map((sig, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>
                          <CheckCircle2 size={14} style={{ color: '#10B981' }} />
                          <div>
                            <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{sig.user}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sig.role} · {new Date(sig.signed_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════
               GUIDANCE PANEL — "Which form should I create?"
               Shows when no form is selected
               Role-based template recommendations
               ═══════════════════════════════════ */
            <div className="rounded-2xl p-6" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
              <h3 className="text-[16px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Which form should you create?</h3>
              <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>
                Each template maps to a specific IEC 62304 or ISO 13485 clause. Choose based on your current task:
              </p>

              <div className="space-y-2">
                {TEMPLATE_GUIDE.map(t => (
                  <button key={t.id} onClick={() => createForm(t.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-150 group"
                    style={{ border: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'rgba(14,165,233,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{ background: 'rgba(14,165,233,0.08)' }}>
                      <t.icon size={16} style={{ color: '#0EA5E9' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono font-bold" style={{ color: 'var(--accent-teal)' }}>{t.id}</code>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.title}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{t.role}</span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.desc} · <span className="font-mono">{t.clause}</span></p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-teal)' }} />
                  </button>
                ))}
              </div>

              <p className="text-[10px] mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {templates.length} templates available (TPL-01 to TPL-11) · Click any to create
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
