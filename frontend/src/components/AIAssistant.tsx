import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Loader2, AlertTriangle, FileText, Shield, Code } from 'lucide-react';
import { aiChat, detectRisks, generateCAPA, reviewCode } from '../api/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_ACTIONS = [
  { label: 'Detect Risks', icon: AlertTriangle, action: 'detect_risks', color: 'text-red-500' },
  { label: 'Generate CAPA', icon: FileText, action: 'generate_capa', color: 'text-blue-500' },
  { label: 'Review Code', icon: Code, action: 'review_code', color: 'text-green-500' },
  { label: 'Compliance Help', icon: Shield, action: 'compliance', color: 'text-purple-500' },
];

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'I\'m your IEC 62304 compliance AI assistant. I can analyze risks, generate CAPAs, review code, and answer compliance questions. How can I help?', timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date().toISOString() }]);
  };

  const handleQuickAction = async (action: string) => {
    setActiveAction(action);
    setLoading(true);

    try {
      if (action === 'detect_risks') {
        addMessage('user', 'Detect risks in recent code changes');
        const { data } = await detectRisks();
        const risks = data.risks_detected || [];
        if (risks.length === 0) {
          addMessage('assistant', 'No significant risks detected in recent code changes. All clear.');
        } else {
          const summary = risks.map((r: any) =>
            `**[${r.severity}]** ${r.title}\n${r.description}\nAction: ${r.recommended_action}`
          ).join('\n\n');
          addMessage('assistant', `Found ${risks.length} risk(s):\n\n${summary}`);
        }
      } else if (action === 'generate_capa') {
        addMessage('user', 'I need to generate a CAPA. What problem should I describe?');
        addMessage('assistant', 'Describe the problem you found. Include:\n\n1. **What happened** (the bug or issue)\n2. **Where** (which module/file)\n3. **Impact** (what could go wrong for the patient)\n\nExample: "The brain volumetry service returns incorrect volume for structures smaller than 1cm3, affecting lesion_analysis_service.py, could lead to underestimation of lesion burden."');
        setLoading(false);
        setActiveAction('awaiting_capa');
        return;
      } else if (action === 'review_code') {
        addMessage('user', 'Review a Class C module for compliance');
        addMessage('assistant', 'Which file should I review? Class C modules:\n\n- `backend/app/services/ai_segmentation_service.py`\n- `backend/app/services/brain_volumetry_service.py`\n- `backend/app/services/brain_report_service.py`\n- `backend/app/services/lesion_analysis_service.py`\n- `backend/app/services/ms_region_classifier.py`\n- `backend/app/utils/nifti_utils.py`\n- `backend/app/utils/dicom_utils.py`\n\nType the file path or just the name.');
        setLoading(false);
        setActiveAction('awaiting_review');
        return;
      } else if (action === 'compliance') {
        addMessage('user', 'Help me with IEC 62304 compliance');
        addMessage('assistant', 'What do you need help with?\n\n- "What forms do I need before a release?"\n- "How do I handle a Class C code change?"\n- "What does clause 5.5 require?"\n- "Is my SOUP list complete?"\n\nAsk me anything about IEC 62304, ISO 13485, or EU MDR.');
        setLoading(false);
        setActiveAction('');
        return;
      }
    } catch (e: any) {
      addMessage('assistant', `Error: ${e.response?.data?.detail || 'AI service unavailable'}`);
    }
    setLoading(false);
    setActiveAction('');
  };

  const handleSpecialInput = async (msg: string) => {
    if (activeAction === 'awaiting_capa') {
      setLoading(true);
      addMessage('user', msg);
      try {
        const { data } = await generateCAPA(msg);
        const rca = data.root_cause_analysis || {};
        const cas = data.corrective_actions || [];
        const pas = data.preventive_actions || [];
        const response = [
          `**Root Cause Analysis**`,
          `Category: ${rca.category || 'N/A'}`,
          `Description: ${rca.description || 'N/A'}`,
          rca.five_whys ? `\n**5 Whys:**\n${rca.five_whys.map((w: string, i: number) => `${i + 1}. ${w}`).join('\n')}` : '',
          `\n**Risk Assessment**`,
          data.risk_assessment ? `Severity: ${data.risk_assessment.severity}, Risk: ${data.risk_assessment.risk_level}` : '',
          `\n**Corrective Actions (${cas.length}):**`,
          ...cas.map((ca: any) => `- ${ca.id}: ${ca.description} (${ca.deadline_days} days)`),
          `\n**Preventive Actions (${pas.length}):**`,
          ...pas.map((pa: any) => `- ${pa.id}: ${pa.description}`),
          data.forms_to_create ? `\n**Forms to create:** ${data.forms_to_create.map((f: any) => f.template_id).join(', ')}` : '',
        ].filter(Boolean).join('\n');
        addMessage('assistant', response);
      } catch (e: any) {
        addMessage('assistant', `Error generating CAPA: ${e.response?.data?.detail || 'AI unavailable'}`);
      }
      setLoading(false);
      setActiveAction('');
      return true;
    }

    if (activeAction === 'awaiting_review') {
      setLoading(true);
      addMessage('user', `Review: ${msg}`);
      let filePath = msg.trim();
      if (!filePath.includes('/')) {
        filePath = `backend/app/services/${filePath}`;
        if (!filePath.endsWith('.py')) filePath += '.py';
      }
      try {
        const { data } = await reviewCode(filePath);
        const issues = data.issues || [];
        const response = [
          `**Code Review: ${data.file || filePath}**`,
          `Verdict: **${data.overall_verdict || 'N/A'}**`,
          `\n| Check | Result |`,
          `|-------|--------|`,
          `| Coding Standards | ${data.coding_standards || 'N/A'} |`,
          `| Error Handling | ${data.error_handling || 'N/A'} |`,
          `| Input Validation | ${data.input_validation || 'N/A'} |`,
          `| OWASP Security | ${data.owasp_review || 'N/A'} |`,
          `| Req Traceability | ${data.requirement_traceability || 'N/A'} |`,
          issues.length > 0 ? `\n**Issues Found (${issues.length}):**` : '\nNo issues found.',
          ...issues.map((i: any) => `- **[${i.severity}]** Line ${i.line}: ${i.description}`),
          data.summary ? `\n${data.summary}` : '',
        ].join('\n');
        addMessage('assistant', response);
      } catch (e: any) {
        addMessage('assistant', `Error reviewing code: ${e.response?.data?.detail || 'AI unavailable'}`);
      }
      setLoading(false);
      setActiveAction('');
      return true;
    }

    return false;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');

    const handled = await handleSpecialInput(msg);
    if (!handled) {
      addMessage('user', msg);
      setLoading(true);
      try {
        const { data } = await aiChat(msg);
        addMessage('assistant', data.response);
      } catch (e: any) {
        addMessage('assistant', `Error: ${e.response?.data?.detail || 'AI unavailable'}`);
      }
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-teal rounded-full shadow-lg flex items-center justify-center hover:bg-teal-light transition-all hover:scale-110 z-50"
        >
          <Sparkles size={24} className="text-white" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-navy p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-teal/20 rounded-lg flex items-center justify-center">
                <Bot size={20} className="text-teal-light" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI Compliance Assistant</h3>
                <p className="text-xs text-gray-400">IEC 62304 + ISO 13485 + EU MDR</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 p-3 border-b border-gray-100 shrink-0 overflow-x-auto">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.action}
                onClick={() => handleQuickAction(qa.action)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-full hover:bg-gray-50 transition whitespace-nowrap disabled:opacity-50"
              >
                <qa.icon size={12} className={qa.color} />
                {qa.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-teal text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-teal" />
                  <span className="text-sm text-gray-500">Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="p-3 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={activeAction ? 'Type your response...' : 'Ask about compliance...'}
                disabled={loading}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-teal text-white rounded-xl hover:bg-teal-light disabled:opacity-50 transition"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}