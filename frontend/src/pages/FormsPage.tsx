import { useEffect, useState } from 'react';
import {
  FileText, Plus, Download, PenTool, CheckCircle2,
  Trash2, Search, Edit, Clock, CheckCircle, Save,
} from 'lucide-react';
import apiClient from '../api/client';

interface FormTemplate {
  template_id: string;
  title: string;
  standard: string;
}

interface FormRecord {
  id: string;
  template_id: string;
  title: string;
  status: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  fields: Record<string, string>;
  signatures: { user: string; role: string; signed_at: string }[];
}

interface TemplateField {
  name: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: string[];
  section: string;
  help_text?: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-[var(--text-secondary)] ring-1 ring-gray-200/50',
  in_review: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50',
  approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50',
  superseded: 'bg-red-50 text-red-600 ring-1 ring-red-200/50',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  draft: Edit,
  in_review: Clock,
  approved: CheckCircle,
};

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
      const [tRes, fRes] = await Promise.all([
        apiClient.get('/forms/templates'),
        apiClient.get('/forms/'),
      ]);
      setTemplates(tRes.data.templates || []);
      setForms(fRes.data.forms || []);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  const createForm = async (templateId: string) => {
    const { data } = await apiClient.post('/forms/', { template_id: templateId });
    setForms((prev) => [data, ...prev]);
    setSelectedForm(data);
    setShowCreate(false);
    loadTemplateFields(templateId);
  };

  const loadTemplateFields = async (templateId: string) => {
    try {
      const { data } = await apiClient.get(`/forms/templates/${templateId}/fields`);
      setTemplateFields(data.fields || []);
    } catch {
      setTemplateFields([]);
    }
  };

  const selectForm = async (form: FormRecord) => {
    setSelectedForm(form);
    await loadTemplateFields(form.template_id);
  };

  const updateField = (name: string, value: string) => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      fields: { ...selectedForm.fields, [name]: value },
    });
  };

  const saveForm = async () => {
    if (!selectedForm) return;
    setSaving(true);
    try {
      const { data } = await apiClient.put(`/forms/${selectedForm.id}`, {
        fields: selectedForm.fields,
      });
      setSelectedForm(data);
      setForms((prev) => prev.map((f) => (f.id === data.id ? data : f)));
    } catch { /* */ }
    setSaving(false);
  };

  const signForm = async () => {
    if (!selectedForm) return;
    const { data } = await apiClient.post(`/forms/${selectedForm.id}/sign`);
    setSelectedForm(data);
    setForms((prev) => prev.map((f) => (f.id === data.id ? data : f)));
  };

  const approveForm = async () => {
    if (!selectedForm) return;
    const { data } = await apiClient.post(`/forms/${selectedForm.id}/approve`);
    setSelectedForm(data);
    setForms((prev) => prev.map((f) => (f.id === data.id ? data : f)));
  };

  const deleteForm = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this form?')) return;
    await apiClient.delete(`/forms/${id}`);
    setForms((prev) => prev.filter((f) => f.id !== id));
    if (selectedForm?.id === id) setSelectedForm(null);
  };

  const downloadPDF = async () => {
    if (!selectedForm) return;
    try {
      const { data } = await apiClient.get(`/forms/${selectedForm.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedForm.template_id}_${selectedForm.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* */ }
  };

  const filteredForms = forms.filter((f) => {
    if (filterStatus && f.status !== filterStatus) return false;
    if (searchQuery && !f.title.toLowerCase().includes(searchQuery.toLowerCase()) && !f.id.includes(searchQuery))
      return false;
    return true;
  });

  const sections = templateFields.reduce<Record<string, TemplateField[]>>((acc, field) => {
    const section = field.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal" />
    </div>
  );

  const draftCount = forms.filter(f => f.status === 'draft').length;
  const reviewCount = forms.filter(f => f.status === 'in_review').length;
  const approvedCount = forms.filter(f => f.status === 'approved').length;

  return (
    <div className="space-y-4">
      {/* ═══ LEVEL 1 — STATUS BANNER ═══ */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{
          background: draftCount > 0 ? 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(14,165,233,0.03))' : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
          border: `1px solid ${draftCount > 0 ? 'rgba(14,165,233,0.15)' : 'rgba(16,185,129,0.15)'}`,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.12)' }}>
            <FileText size={24} style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <span className="text-[18px] font-bold" style={{ color: 'var(--text-primary)' }}>Regulatory Forms</span>
            <p className="text-[13px] mt-0.5 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
              <span>{forms.length} total</span>
              {draftCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />{draftCount} draft</span>}
              {reviewCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{reviewCount} in review</span>}
              {approvedCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{approvedCount} approved</span>}
              <span>· 11 templates (TPL-01 to TPL-11)</span>
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-white px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
          <Plus size={15} /> New Form
        </button>
      </div>

      {/* ═══ LEVEL 2 — FORM LIST + EDITOR ═══ */}
      <div className="flex gap-5 h-[calc(100vh-12rem)]">
      {/* Left Panel */}
      <div className="w-96 flex flex-col shrink-0">

        {showCreate && (
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-lg shadow-gray-200/50 p-4 mb-4 max-h-72 overflow-y-auto">
            <p className="text-[10px] text-[var(--text-muted)] mb-2 font-bold uppercase tracking-widest">Select Template</p>
            {templates.map((t) => (
              <button
                key={t.template_id}
                onClick={() => createForm(t.template_id)}
                className="w-full text-left px-3 py-2.5 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50/30 rounded-xl text-sm flex items-center justify-between transition-all duration-150"
              >
                <span>
                  <span className="font-mono text-xs text-[var(--text-muted)] mr-2">{t.template_id}</span>
                  {t.title}
                </span>
                <span className="text-xs text-[var(--text-muted)] shrink-0 ml-2">{t.standard}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..." className="w-full pl-8 pr-3 py-2 text-[13px] border border-[var(--border-default)] rounded-xl focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-all"
            />
          </div>
          <select
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="text-[13px] border border-[var(--border-default)] rounded-xl px-3 py-2 focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-all"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="in_review">Review</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredForms.map((form) => {
            const Icon = STATUS_ICONS[form.status] || Edit;
            return (
              <div
                key={form.id} onClick={() => selectForm(form)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                  selectedForm?.id === form.id ? 'border-teal/30 bg-gradient-to-r from-sky-50/50 to-blue-50/30 shadow-md shadow-teal/5' : 'border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm hover:shadow-md hover:border-[var(--border-default)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--text-muted)]">{form.template_id}</span>
                  <div className="flex items-center gap-1">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[form.status] || ''}`}>
                      <Icon size={10} /> {form.status}
                    </span>
                    <button onClick={(e) => deleteForm(form.id, e)} className="text-[var(--text-muted)] hover:text-red-500 ml-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-1 truncate">{form.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{form.created_by || 'Unknown'} &middot; {form.created_at ? new Date(form.created_at).toLocaleDateString() : ''}</p>
              </div>
            );
          })}
          {filteredForms.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">No forms found</p>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto">
        {selectedForm ? (
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] shadow-card">
            <div className="p-6 border-b border-[var(--card-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-[var(--text-muted)]">{selectedForm.template_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[selectedForm.status] || ''}`}>
                      {selectedForm.status}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">v{selectedForm.version}</span>
                  </div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1">{selectedForm.title}</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1">ID: {selectedForm.id} | Created: {selectedForm.created_at ? new Date(selectedForm.created_at).toLocaleString() : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={downloadPDF} className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-2 border border-[var(--border-default)] rounded-xl hover:bg-[var(--bg-tertiary)] transition-all">
                    <Download size={13} /> PDF
                  </button>
                  <button onClick={signForm} className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-800 px-3 py-2 border border-blue-200 rounded-xl hover:bg-blue-50 transition-all">
                    <PenTool size={13} /> Sign
                  </button>
                  {selectedForm.status !== 'approved' && (
                    <button onClick={approveForm} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 hover:text-emerald-800 px-3 py-2 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all">
                      <CheckCircle2 size={13} /> Approve
                    </button>
                  )}
                  <button onClick={saveForm} disabled={saving}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-white px-4 py-2 rounded-xl disabled:opacity-50 transition-all duration-200 hover:shadow-lg hover:shadow-teal/20 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                    <Save size={13} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {Object.keys(sections).length > 0 ? (
                Object.entries(sections).map(([sectionName, fields]) => (
                  <div key={sectionName}>
                    <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4 pb-2 border-b border-[var(--card-border)]">
                      {sectionName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map((field) => (
                        <div key={field.name} className={field.field_type === 'textarea' ? 'col-span-2' : ''}>
                          <label className="block text-sm text-[var(--text-secondary)] mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.help_text && <p className="text-xs text-[var(--text-muted)] mb-1">{field.help_text}</p>}
                          {field.field_type === 'textarea' ? (
                            <textarea
                              value={selectedForm.fields[field.name] || ''} onChange={(e) => updateField(field.name, e.target.value)}
                              rows={3} className="w-full border border-[var(--border-default)] rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-all"
                            />
                          ) : field.field_type === 'select' ? (
                            <select
                              value={selectedForm.fields[field.name] || ''} onChange={(e) => updateField(field.name, e.target.value)}
                              className="w-full border border-[var(--border-default)] rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-all"
                            >
                              <option value="">Select...</option>
                              {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : field.field_type === 'checkbox' ? (
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={selectedForm.fields[field.name] === 'true'} onChange={(e) => updateField(field.name, String(e.target.checked))} />
                              <span className="text-sm text-[var(--text-secondary)]">Yes</span>
                            </label>
                          ) : (
                            <input
                              type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
                              value={selectedForm.fields[field.name] || ''} onChange={(e) => updateField(field.name, e.target.value)}
                              className="w-full border border-[var(--border-default)] rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-all"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-4 italic">
                    Use the fields below to fill in the form. Fields are saved to Firestore.
                  </p>
                  {Object.entries(selectedForm.fields).length > 0 ? (
                    Object.entries(selectedForm.fields).map(([key, val]) => (
                      <div key={key} className="mb-3">
                        <label className="block text-sm text-[var(--text-secondary)] mb-1">{key}</label>
                        <input type="text" value={val} onChange={(e) => updateField(key, e.target.value)}
                          className="w-full border border-[var(--border-default)] rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-teal/50 focus:ring-2 focus:ring-teal/10 transition-all" />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No fields yet. They will appear when the template definition is loaded.</p>
                  )}
                </div>
              )}

              {selectedForm.signatures.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4 pb-2 border-b border-[var(--card-border)]">
                    Electronic Signatures
                  </h3>
                  <div className="space-y-2">
                    {selectedForm.signatures.map((sig, i) => (
                      <div key={i} className="flex items-center gap-4 p-3.5 bg-gradient-to-r from-emerald-50 to-green-50/50 rounded-xl border border-emerald-100/80">
                        <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{sig.user}</p>
                          <p className="text-xs text-[var(--text-muted)]">{sig.role} &middot; {new Date(sig.signed_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText size={48} className="text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">Select a form or create a new one</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">TPL-01 to TPL-11 | IEC 62304 + ISO 13485</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}