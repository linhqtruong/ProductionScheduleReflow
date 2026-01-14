import { useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  MarkerType,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DAG } from '../reflow/dag';
import { WorkOrder } from '../reflow/types';
import './DAGVisualization.css';

interface DAGVisualizationProps {
  workOrders: WorkOrder[];
}

/**
 * Professional DAG Visualization using React Flow
 * Replaces custom SVG implementation with React Flow for better interactivity
 */
export default function DAGVisualization({ workOrders }: DAGVisualizationProps) {
  const { nodes, edges } = useMemo(() => {
    if (workOrders.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Build DAG
    const dag = new DAG();
    dag.build(workOrders);

    // Get visualization data
    const dagData = dag.getVisualizationData();

    // Convert to React Flow nodes
    const reactFlowNodes: Node[] = dagData.nodes.map((node) => {
      const workOrder = workOrders.find(wo => wo.docId === node.id);
      const isMaintenance = workOrder?.data.isMaintenance || false;
      
      return {
        id: node.id,
        type: 'default',
        position: { x: 0, y: 0 }, // Position will be calculated by layout
        data: {
          label: node.label,
          isMaintenance,
        },
        style: {
          background: isMaintenance ? '#ef4444' : '#6366f1',
          color: '#fff',
          border: '2px solid #fff',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '14px',
          padding: '10px 16px',
          minWidth: '120px',
          textAlign: 'center',
        },
      };
    });

    // Convert to React Flow edges
    const reactFlowEdges: Edge[] = dagData.edges.map((edge, index) => ({
      id: `edge-${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: '#64748b',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#64748b',
      },
    }));

    return { nodes: reactFlowNodes, edges: reactFlowEdges };
  }, [workOrders]);

  // Calculate hierarchical layout
  const layoutedNodes = useMemo(() => {
    if (nodes.length === 0) return [];

    // Build dependency map
    const dependencyMap = new Map<string, string[]>();
    const dependentMap = new Map<string, string[]>();
    
    edges.forEach(edge => {
      if (!dependencyMap.has(edge.target)) {
        dependencyMap.set(edge.target, []);
      }
      dependencyMap.get(edge.target)!.push(edge.source);
      
      if (!dependentMap.has(edge.source)) {
        dependentMap.set(edge.source, []);
      }
      dependentMap.get(edge.source)!.push(edge.target);
    });

    // Find root nodes (no dependencies)
    const rootNodes = nodes.filter(node => !dependencyMap.has(node.id));
    
    // Calculate levels using BFS
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [];

    rootNodes.forEach(node => {
      levels.set(node.id, 0);
      queue.push({ id: node.id, level: 0 });
      visited.add(node.id);
    });

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const children = dependentMap.get(id) || [];

      children.forEach(childId => {
        if (!visited.has(childId)) {
          levels.set(childId, level + 1);
          queue.push({ id: childId, level: level + 1 });
          visited.add(childId);
        } else {
          // Update level if this path is longer
          const currentLevel = levels.get(childId) || 0;
          levels.set(childId, Math.max(currentLevel, level + 1));
        }
      });
    }

    // Group nodes by level
    const nodesByLevel = new Map<number, Node[]>();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });

    // Position nodes hierarchically
    const nodeWidth = 150;
    const nodeHeight = 80;
    const levelSpacing = 200;
    const nodeSpacing = 180;

    const positionedNodes: Node[] = [];
    nodesByLevel.forEach((levelNodes, level) => {
      const levelWidth = levelNodes.length * nodeSpacing;
      const startX = -levelWidth / 2 + nodeSpacing / 2;

      levelNodes.forEach((node, index) => {
        positionedNodes.push({
          ...node,
          position: {
            x: startX + index * nodeSpacing,
            y: level * levelSpacing,
          },
        });
      });
    });

    return positionedNodes;
  }, [nodes, edges]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node);
  }, []);

  if (workOrders.length === 0 || nodes.length === 0) {
    return <div className="dag-empty">No dependencies to visualize</div>;
  }

  return (
    <div className="dag-visualization">
      <h3>Dependency Graph Visualization</h3>
      <div className="dag-reactflow-container">
        <ReactFlowProvider>
          <ReactFlow
            nodes={layoutedNodes}
            edges={edges}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.2}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => {
                const isMaintenance = (node.data as any)?.isMaintenance;
                return isMaintenance ? '#ef4444' : '#6366f1';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      <div className="dag-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#6366f1' }} />
          <span>Production Orders</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
          <span>Maintenance Orders</span>
        </div>
      </div>
    </div>
  );
}
