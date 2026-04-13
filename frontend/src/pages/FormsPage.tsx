import { useEffect, useState } from 'react';
import { getTemplates, createForm, listForms } from '../api/forms';
import { FileText, Plus, CheckCircle, Clock, Edit } from 'lucide-react';

interface Template { template_id: string; title: string; standard: string; }
interface Form { id: string; template_id: string; title: string; status: string; created_at: string; }

const STATUS_BADGE: Record<string, { color: string; icon: React.ElementType }> = {
  draft: { color: 'bg-gray-100 text-gray-700', icon: Edit },
  in_review: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

export default function FormsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    getTemplates().then(r => setTemplates(r.data.templates));
    listForms().then(r => setForms(r.data.forms));
  }, []);

  const handleCreate = async (templateId: string) => {
    const res = await createForm(templateId);
    setForms(prev => [res.data, ...prev]);
    setShowCreate(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Digital audit templates (TPL-01 to TPL-11)</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal-light transition"
        >
          <Plus size={16} /> New Form
        </button>
      </div>

      {/* Template Picker */}
      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Select Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(t => (
              <button
                key={t.template_id}
                onClick={() => handleCreate(t.template_id)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-teal hover:bg-teal/5 transition"
              >
                <div className="font-medium text-sm text-gray-900">{t.template_id}</div>
                <div className="text-sm text-gray-600 mt-1">{t.title}</div>
                <div className="text-xs text-gray-400 mt-1">{t.standard}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Forms List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Records ({forms.length})</h2>
        </div>
        {forms.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-50" />
            <p>No forms created yet. Click "New Form" to start.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {forms.map(f => {
              const badge = STATUS_BADGE[f.status] || STATUS_BADGE.draft;
              const Icon = badge.icon;
              return (
                <div key={f.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{f.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{f.template_id} | {f.created_at}</div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${badge.color}`}>
                    <Icon size={12} /> {f.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
