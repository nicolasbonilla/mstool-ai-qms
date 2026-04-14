import { useEffect, useState, useCallback } from 'react';
import { ReactFlow, MiniMap, Controls, Background, Node, Edge, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getTraceabilityGraph } from '../api/compliance';
import { AlertTriangle, GitBranch } from 'lucide-react';

interface GraphData {
  nodes: { id: string; type: string; label: string; metadata: Record<string, any> }[];
  edges: { source: string; target: string; type: string }[];
  orphans: { requirements_without_tests: string[]; risk_controls_without_verification: string[]; code_without_requirements: string[] };
  stats: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  requirement: '#3B82F6',
  architecture: '#8B5CF6',
  code: '#10B981',
  test: '#F59E0B',
  risk_control: '#EF4444',
};

const TYPE_LABELS: Record<string, string> = {
  requirement: 'REQ',
  architecture: 'ARCH',
  code: 'CODE',
  test: 'TEST',
  risk_control: 'RISK',
};

export default function TraceabilityPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTraceabilityGraph()
      .then(({ data }) => {
        setData(data);
        layoutGraph(data);
      })
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load traceability'))
      .finally(() => setLoading(false));
  }, []);

  const layoutGraph = (graph: GraphData) => {
    // Group nodes by type
    const groups: Record<string, typeof graph.nodes> = {};
    graph.nodes.forEach((n) => {
      if (!groups[n.type]) groups[n.type] = [];
      groups[n.type].push(n);
    });

    // Layout config: each type gets a row, laid out in a grid
    const typeOrder = ['requirement', 'architecture', 'code', 'test', 'risk_control'];
    const NODE_W = 200;
    const NODE_H = 70;
    const COLS = 12; // nodes per row within each type section
    const SECTION_GAP = 150; // gap between type sections

    const nodes: Node[] = [];
    let currentY = 0;

    typeOrder.forEach((type) => {
      const items = groups[type] || [];
      if (items.length === 0) return;

      items.forEach((n, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        nodes.push({
          id: n.id,
          position: { x: col * NODE_W, y: currentY + row * NODE_H },
          data: {
            label: (
              <div style={{ padding: '6px 10px', borderRadius: 6, border: `2px solid ${TYPE_COLORS[n.type]}`, background: `${TYPE_COLORS[n.type]}15`, maxWidth: 170, fontSize: 10 }}>
                <div style={{ fontSize: 8, color: TYPE_COLORS[n.type], fontWeight: 700 }}>{TYPE_LABELS[n.type]}</div>
                <div style={{ color: '#1E293B', lineHeight: 1.2, wordBreak: 'break-word' }}>{n.id.length > 25 ? n.id.slice(0, 25) + '...' : n.id}</div>
              </div>
            ),
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });
      });

      const rows = Math.ceil(items.length / COLS);
      currentY += rows * NODE_H + SECTION_GAP;
    });

    const edgeStyles: Record<string, any> = {
      traces_to: { stroke: '#8B5CF6', strokeWidth: 1.5 },
      implemented_by: { stroke: '#10B981', strokeWidth: 1.5 },
      tested_by: { stroke: '#F59E0B', strokeWidth: 1.5, strokeDasharray: '5,5' },
      mitigated_by: { stroke: '#EF4444', strokeWidth: 1, strokeDasharray: '3,3', opacity: 0.4 },
    };

    // Limit edges shown to avoid visual chaos — prioritize non-mitigated edges
    const nonMitigated = graph.edges.filter(e => e.type !== 'mitigated_by');
    const mitigated = graph.edges.filter(e => e.type === 'mitigated_by').slice(0, 30); // cap at 30
    const visibleEdges = [...nonMitigated, ...mitigated];

    const edges: Edge[] = visibleEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      style: edgeStyles[e.type] || { stroke: '#94A3B8' },
      animated: e.type === 'tested_by',
    }));

    setRfNodes(nodes);
    setRfEdges(edges);
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal" /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-6"><p className="text-red-700">{error}</p></div>;
  if (!data) return null;

  const totalOrphans = data.orphans.requirements_without_tests.length + data.orphans.risk_controls_without_verification.length + data.orphans.code_without_requirements.length;

  return (
    <div className="h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traceability Explorer</h1>
          <p className="text-sm text-gray-500">REQ → Architecture → Code → Tests → Risk Controls</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(TYPE_COLORS).map(([type, color]) => {
            const count = data.nodes.filter(n => n.type === type).length;
            return (
              <span key={type} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                {TYPE_LABELS[type]} ({count})
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100%-4rem)]">
        {/* Graph */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100/80 shadow-card overflow-hidden">
          <ReactFlow nodes={rfNodes} edges={rfEdges} onNodeClick={onNodeClick} fitView
            minZoom={0.2} maxZoom={2} defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}>
            <Controls />
            <MiniMap nodeColor={(n) => TYPE_COLORS[data.nodes.find(dn => dn.id === n.id)?.type || 'code'] || '#94A3B8'} />
            <Background />
          </ReactFlow>
        </div>

        {/* Orphans Panel */}
        <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-100/80 shadow-card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <GitBranch size={16} /> Stats
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Nodes</span><span className="font-medium">{data.stats.total_nodes}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Edges</span><span className="font-medium">{data.stats.total_edges}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Requirements</span><span className="font-medium">{data.stats.requirements}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tests</span><span className="font-medium">{data.stats.tests}</span></div>
            </div>
          </div>

          {totalOrphans > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-card p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} /> Orphans ({totalOrphans})
              </h3>
              {data.orphans.requirements_without_tests.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-red-600 mb-1">REQs without tests:</p>
                  {data.orphans.requirements_without_tests.slice(0, 10).map(id => (
                    <p key={id} className="text-xs text-gray-600 font-mono">{id}</p>
                  ))}
                </div>
              )}
              {data.orphans.risk_controls_without_verification.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Risks without verification:</p>
                  {data.orphans.risk_controls_without_verification.slice(0, 10).map(id => (
                    <p key={id} className="text-xs text-gray-600 font-mono">{id}</p>
                  ))}
                </div>
              )}
              {data.orphans.code_without_requirements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-yellow-600 mb-1">Code without REQs:</p>
                  {data.orphans.code_without_requirements.slice(0, 10).map(id => (
                    <p key={id} className="text-xs text-gray-600 font-mono">{id}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}