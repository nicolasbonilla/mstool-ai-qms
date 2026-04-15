import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, FileText, Users, ShieldCheck, ClipboardCheck, AlertTriangle } from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

const TEMPLATE_REF = [
  { id: 'TPL-01', title: 'Problem Report', clause: 'IEC 62304 Clause 9', when: 'Bug found or reported', who: 'Developer, QA' },
  { id: 'TPL-02', title: 'Release Checklist', clause: 'IEC 62304 Clause 5.8', when: 'Before each release', who: 'Developer, QA, QMS Manager' },
  { id: 'TPL-03', title: 'Code Review Checklist', clause: 'IEC 62304 Clause 5.5.3', when: 'Every code review (mandatory for Class C)', who: 'Developer, Reviewer' },
  { id: 'TPL-04', title: 'Risk Control Verification', clause: 'ISO 14971 Clause 7.4', when: 'When verifying risk controls', who: 'QA, Clinical Advisor' },
  { id: 'TPL-05', title: 'Design Review Record', clause: 'IEC 62304 Clause 5.3/5.4', when: 'Architecture/design reviews', who: 'Design Lead, Reviewers' },
  { id: 'TPL-06', title: 'Test Execution Report', clause: 'IEC 62304 Clause 5.5.5', when: 'After running test suites', who: 'QA, Tester' },
  { id: 'TPL-07', title: 'SOUP Vulnerability Review', clause: 'IEC 81001-5-1 Clause 5.3.12', when: 'Monthly dependency review', who: 'Security Reviewer, QMS Manager' },
  { id: 'TPL-08', title: 'Serious Incident Report', clause: 'EU MDR Article 87', when: 'Patient safety incident', who: 'Reporter, Clinical Advisor, QMS Manager' },
  { id: 'TPL-09', title: 'Change Control Record', clause: 'IEC 62304 Clause 8', when: 'Any change to the system', who: 'Developer, QA, QMS Manager' },
  { id: 'TPL-10', title: 'Quality Gate Approval', clause: 'IEC 62304 Clause 5.1', when: 'Before progressing to next phase', who: 'Phase Lead, QA, QMS Manager' },
  { id: 'TPL-11', title: 'Document Approval Record', clause: 'ISO 13485 Clause 4.2.4', when: 'When approving/revising documents', who: 'Author, Reviewer, QMS Manager' },
];

const ROLES_DATA = [
  { role: 'Admin', permissions: 'Full access. Manage users, run audits, approve forms, configure system', typical: 'Project Lead' },
  { role: 'QMS Manager', permissions: 'Run audits, approve forms, manage users, view audit trail', typical: 'Quality Manager' },
  { role: 'Developer', permissions: 'Create/edit forms, view dashboard, view traceability', typical: 'Software Developer' },
  { role: 'QA', permissions: 'Create/edit forms, run tests, view all reports', typical: 'QA Engineer' },
  { role: 'Clinical Advisor', permissions: 'View reports, sign clinical forms, review risk controls', typical: 'Clinical Expert' },
  { role: 'Viewer', permissions: 'Read-only access to all dashboards and reports', typical: 'Stakeholder/Auditor' },
];

const AUDIT_CHECKLIST = [
  'Full Audit simulation score >95%',
  'All Traceability orphans resolved (no requirements without tests)',
  'All forms for current release signed and approved',
  'SOUP vulnerability scan run within last 30 days',
  'All regulatory documents "Fresh" (green) on Doc Sync',
  'All Class C modules have code review records (TPL-03)',
  'All hazards have verified risk controls (TPL-04)',
  'Release checklist (TPL-02) approved for current version',
  'Quality gate approval (TPL-10) signed for current phase',
  'Audit trail shows consistent usage over development period',
  'PDF exports of all critical forms available for auditor',
  'Team members can demonstrate live use of QMS platform',
];

export default function GuidePage() {
  const [expandedSection, setExpandedSection] = useState<string>('daily');

  const toggle = (id: string) => setExpandedSection(expandedSection === id ? '' : id);

  const sections: Section[] = [
    {
      id: 'daily',
      title: 'Daily Workflow',
      icon: ClipboardCheck,
      content: (
        <div className="space-y-6">
          {/* Developers */}
          <div className="bg-gradient-to-r from-blue-50 to-sky-50/50 border border-blue-100/80 rounded-2xl p-6">
            <h4 className="font-semibold text-blue-900 mb-3">For Developers</h4>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-blue-800 mb-2">Every morning:</p>
                <ul className="text-sm text-blue-700 space-y-1 ml-4">
                  <li>1. Open <strong>Dashboard</strong> — check compliance scores haven't dropped</li>
                  <li>2. Check <strong>SOUP</strong> page — any new CVE vulnerabilities?</li>
                  <li>3. Review any open forms assigned to you</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 mb-2">When making code changes:</p>
                <ul className="text-sm text-blue-700 space-y-1 ml-4">
                  <li>1. Ensure your change traces to a requirement (REQ-FUNC-XXX or REQ-SAFE-XXX)</li>
                  <li>2. If touching a Class C module, create a <strong>TPL-03 Code Review Checklist</strong> BEFORE merging</li>
                  <li>3. After merging, verify CI pipeline passes on Dashboard</li>
                  <li>4. If a new risk is introduced, create <strong>TPL-04 Risk Control Verification</strong></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 mb-2">When fixing bugs:</p>
                <ul className="text-sm text-blue-700 space-y-1 ml-4">
                  <li>1. Create <strong>TPL-01 Problem Report</strong> documenting the issue</li>
                  <li>2. Fill in root cause analysis after investigation</li>
                  <li>3. After fix is merged, complete verification section</li>
                  <li>4. Get QMS Manager approval</li>
                </ul>
              </div>
            </div>
          </div>

          {/* QA */}
          <div className="bg-gradient-to-r from-purple-50 to-violet-50/50 border border-purple-100/80 rounded-2xl p-6">
            <h4 className="font-semibold text-purple-900 mb-3">For QA Engineers</h4>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-purple-800 mb-2">Every morning:</p>
                <ul className="text-sm text-purple-700 space-y-1 ml-4">
                  <li>1. Open <strong>Dashboard</strong> — check test coverage hasn't dropped</li>
                  <li>2. Check for any new Problem Reports (TPL-01) that need verification</li>
                  <li>3. Review SOUP page for new vulnerabilities</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-800 mb-2">When running tests:</p>
                <ul className="text-sm text-purple-700 space-y-1 ml-4">
                  <li>1. Create <strong>TPL-06 Test Execution Report</strong> for each test session</li>
                  <li>2. Record environment details (OS, versions, dependencies)</li>
                  <li>3. Document all failures with severity and linked requirements</li>
                  <li>4. Sign the form when complete</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-800 mb-2">Before each release:</p>
                <ul className="text-sm text-purple-700 space-y-1 ml-4">
                  <li>1. Complete <strong>TPL-02 Release Checklist</strong></li>
                  <li>2. Run <strong>Full Audit</strong> simulation — target score &gt;90%</li>
                  <li>3. Create <strong>TPL-10 Quality Gate Approval</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* QMS Manager */}
          <div className="bg-gradient-to-r from-teal/5 to-sky-50/30 border border-teal/10 rounded-2xl p-6">
            <h4 className="font-semibold text-[var(--text-primary)] mb-3">For QMS Managers</h4>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">Weekly:</p>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1 ml-4">
                  <li>1. Run a <strong>Full Audit</strong> simulation and review gaps</li>
                  <li>2. Review audit trail for completeness</li>
                  <li>3. Check document freshness on <strong>Doc Sync</strong> — update any "Outdated" docs</li>
                  <li>4. Review and approve pending forms</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">Monthly:</p>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1 ml-4">
                  <li>1. Review SOUP dependency scan — ensure no unmitigated critical CVEs</li>
                  <li>2. Run <strong>Random Commit Audit</strong> and <strong>Random Requirement Audit</strong></li>
                  <li>3. Complete <strong>TPL-07 SOUP Vulnerability Review</strong></li>
                  <li>4. Update <strong>TPL-11 Document Approval Record</strong> for revised documents</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">Before external audit:</p>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1 ml-4">
                  <li>1. Run Full Audit — score must be &gt;95%</li>
                  <li>2. Review all Traceability orphans</li>
                  <li>3. Ensure all forms are signed and approved</li>
                  <li>4. Export all forms as PDFs for auditor review</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'templates',
      title: 'Template Reference (TPL-01 to TPL-11)',
      icon: FileText,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-[var(--card-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Template</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Standard</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">When to Use</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Responsible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TEMPLATE_REF.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-teal">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{t.title}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{t.clause}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{t.when}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{t.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'pages',
      title: 'How to Use Each Page',
      icon: BookOpen,
      content: (
        <div className="space-y-6">
          <div className="bg-white border border-[var(--card-border)] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><span className="text-blue-500">Dashboard</span></h4>
            <p className="text-sm text-[var(--text-secondary)] mb-3">Real-time compliance scores from your repository. Shows IEC 62304, ISO 13485, Cybersecurity, and CE Mark scores.</p>
            <div className="bg-gradient-to-r from-gray-50 to-gray-50/30 rounded-xl p-4 text-xs text-[var(--text-secondary)] space-y-1.5">
              <p><strong>Score &ge;80%</strong> = green (on track)</p>
              <p><strong>Score 60-80%</strong> = yellow (needs attention)</p>
              <p><strong>Score &lt;60%</strong> = red (immediate action required)</p>
              <p className="mt-2">When a score drops, check the breakdown metrics to identify which area needs work, then create the appropriate form to generate evidence.</p>
            </div>
          </div>

          <div className="bg-white border border-[var(--card-border)] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2"><span className="text-blue-500">Forms</span></h4>
            <p className="text-sm text-[var(--text-secondary)] mb-3">Create, fill, sign, and approve regulatory forms. All 11 templates with complete fields per standard.</p>
            <div className="bg-gradient-to-r from-gray-50 to-gray-50/30 rounded-xl p-4 text-xs text-[var(--text-secondary)] space-y-1.5">
              <p><strong>Create</strong>: Click "+ New" &rarr; select template &rarr; form opens in Draft</p>
              <p><strong>Fill</strong>: Complete all required fields (*) &rarr; click "Save"</p>
              <p><strong>Sign</strong>: Click "Sign" to add your electronic signature</p>
              <p><strong>Approve</strong>: QMS Manager clicks "Approve" to lock the form</p>
              <p><strong>Export</strong>: Click "PDF" to download for auditor review</p>
              <p className="mt-2">Form lifecycle: <strong>Draft &rarr; In Review &rarr; Approved</strong></p>
            </div>
          </div>

          <div className="bg-white border border-[var(--card-border)] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2"><span className="text-blue-500">Traceability</span></h4>
            <p className="text-sm text-[var(--text-secondary)] mb-3">Interactive graph showing REQ &rarr; Architecture &rarr; Code &rarr; Tests &rarr; Risk Controls.</p>
            <div className="bg-gradient-to-r from-gray-50 to-gray-50/30 rounded-xl p-4 text-xs text-[var(--text-secondary)] space-y-1.5">
              <p><strong>Blue</strong> = Requirements | <strong>Purple</strong> = Architecture | <strong>Green</strong> = Code | <strong>Amber</strong> = Tests | <strong>Red</strong> = Risk Controls</p>
              <p><strong>Orphans</strong> (right panel): Items without connections = compliance gaps</p>
              <p className="mt-2">When an auditor asks "show me the test for REQ-FUNC-040", use this page to trace the path.</p>
            </div>
          </div>

          <div className="bg-white border border-[var(--card-border)] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2"><span className="text-blue-500">Audit</span></h4>
            <p className="text-sm text-[var(--text-secondary)] mb-3">Simulate a real IEC 62304 audit. Three modes: Full, Random Commit, Random Requirement.</p>
            <div className="bg-gradient-to-r from-gray-50 to-gray-50/30 rounded-xl p-4 text-xs text-[var(--text-secondary)] space-y-1.5">
              <p><strong>Full Audit</strong>: Checks all 20 IEC 62304 clauses (5.1-9.3). Use before external audit.</p>
              <p><strong>Random Commit</strong>: Picks a commit and traces to requirements + CI. Weekly spot-check.</p>
              <p><strong>Random Requirement</strong>: Picks a REQ and traces all evidence. Weekly spot-check.</p>
              <p className="mt-2">Target: <strong>&gt;95% for external audit</strong>, &gt;80% during development.</p>
            </div>
          </div>

          <div className="bg-white border border-[var(--card-border)] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2"><span className="text-blue-500">SOUP</span></h4>
            <p className="text-sm text-[var(--text-secondary)] mb-3">Software of Unknown Provenance — tracks all dependencies and checks for CVE vulnerabilities.</p>
            <div className="bg-gradient-to-r from-gray-50 to-gray-50/30 rounded-xl p-4 text-xs text-[var(--text-secondary)] space-y-1.5">
              <p><strong>Class C</strong> (red): Clinical data processing (nibabel, numpy, scipy, pydicom)</p>
              <p><strong>Class B</strong> (yellow): Core app logic (fastapi, react, firebase)</p>
              <p><strong>Class A</strong> (green): Dev/build tools (pytest, vite, typescript)</p>
              <p className="mt-2">Click "Scan for CVEs" monthly. Critical/High CVEs in Class C require immediate action.</p>
            </div>
          </div>

          <div className="bg-white border border-[var(--card-border)] rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
            <h4 className="font-semibold text-[var(--text-primary)] mb-2"><span className="text-blue-500">Doc Sync</span></h4>
            <p className="text-sm text-[var(--text-secondary)] mb-3">Tracks all regulatory documents with freshness indicators.</p>
            <div className="bg-gradient-to-r from-gray-50 to-gray-50/30 rounded-xl p-4 text-xs text-[var(--text-secondary)] space-y-1.5">
              <p><strong>Green</strong> = Fresh (modified within 30 days)</p>
              <p><strong>Yellow</strong> = Review needed (30-90 days)</p>
              <p><strong>Red</strong> = Outdated (&gt;90 days) — update required</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      title: 'Roles & Permissions',
      icon: Users,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-[var(--card-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Permissions</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Typical Person</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ROLES_DATA.map((r) => (
                <tr key={r.role} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{r.role}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.permissions}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{r.typical}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: 'audit-prep',
      title: 'Audit Preparation Checklist',
      icon: AlertTriangle,
      content: (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h4 className="font-semibold text-yellow-900 mb-4">Before an External Audit — Complete ALL Items</h4>
          <div className="space-y-3">
            {AUDIT_CHECKLIST.map((item, i) => (
              <label key={i} className="flex items-start gap-3 text-sm text-yellow-800 cursor-pointer">
                <input type="checkbox" className="mt-0.5 rounded border-yellow-400" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'standards',
      title: 'IEC 62304 Clause Mapping',
      icon: ShieldCheck,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-[var(--card-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Clause</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)]">QMS Feature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['5.1', 'Software Development Planning', 'Dashboard + TPL-10'],
                ['5.2', 'Software Requirements Analysis', 'Traceability + TPL-05'],
                ['5.3', 'Software Architectural Design', 'Traceability + TPL-05'],
                ['5.4', 'Software Detailed Design', 'Traceability + TPL-05'],
                ['5.5', 'Unit Implementation & Verification', 'Dashboard (tests) + TPL-03/06'],
                ['5.6', 'Integration Testing', 'Dashboard (CI) + TPL-06'],
                ['5.7', 'System Testing', 'TPL-06'],
                ['5.8', 'Software Release', 'TPL-02'],
                ['6.1', 'Maintenance Planning', 'Doc Sync'],
                ['6.2', 'Problem/Modification Analysis', 'TPL-01 + TPL-09'],
                ['7.1', 'Risk Analysis', 'Traceability + TPL-04'],
                ['7.2', 'Risk Control', 'Traceability + TPL-04'],
                ['7.3', 'Risk Control Verification', 'TPL-04'],
                ['7.4', 'Risk Management of Changes', 'TPL-09 + TPL-04'],
                ['8.1', 'Configuration Identification', 'SOUP + Dashboard'],
                ['8.2', 'Change Control', 'TPL-09'],
                ['8.3', 'Configuration Status Accounting', 'Dashboard + Git'],
                ['9.1', 'Problem Reports', 'TPL-01'],
                ['9.2', 'Investigation', 'TPL-01 (root cause)'],
                ['9.3', 'Advisory Notices', 'TPL-08'],
              ].map(([clause, title, feature]) => (
                <tr key={clause} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-teal">{clause}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{title}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{feature}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">QMS Operational Guide</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Step-by-step instructions for daily use of MSTool-AI-QMS
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          IEC 62304:2006+A1:2015 | ISO 13485:2016 | IEC 81001-5-1:2021 | EU MDR 2017/745
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = expandedSection === section.id;
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white rounded-2xl border border-[var(--card-border)] shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden">
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-tertiary)] transition text-left"
              >
                <div className="p-2.5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(139,92,246,0.08))' }}>
                  <Icon size={20} className="text-teal" />
                </div>
                <span className="flex-1 text-base font-semibold text-[var(--text-primary)]">{section.title}</span>
                {isOpen ? <ChevronDown size={20} className="text-[var(--text-muted)]" /> : <ChevronRight size={20} className="text-[var(--text-muted)]" />}
              </button>
              {isOpen && (
                <div className="px-6 pb-6 border-t border-[var(--card-border)] pt-4">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}