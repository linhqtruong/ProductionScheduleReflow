/**
 * Directed Acyclic Graph (DAG) implementation for dependency management
 * 
 * Handles:
 * - Building dependency graph from work orders
 * - Topological sorting
 * - Cycle detection
 * - Dependency traversal
 */

import { WorkOrder } from './types';

export interface DAGNode {
  workOrderId: string;
  workOrder: WorkOrder;
  dependencies: string[]; // IDs of parent nodes
  dependents: string[]; // IDs of child nodes
}

export class DAG {
  private nodes: Map<string, DAGNode> = new Map();
  private workOrderMap: Map<string, WorkOrder> = new Map();

  /**
   * Build DAG from work orders
   */
  build(workOrders: WorkOrder[]): void {
    this.nodes.clear();
    this.workOrderMap.clear();

    // Create work order map
    workOrders.forEach(wo => {
      this.workOrderMap.set(wo.docId, wo);
    });

    // Create nodes
    workOrders.forEach(wo => {
      const node: DAGNode = {
        workOrderId: wo.docId,
        workOrder: wo,
        dependencies: [...wo.data.dependsOnWorkOrderIds],
        dependents: [],
      };
      this.nodes.set(wo.docId, node);
    });

    // Build dependents (reverse dependencies)
    this.nodes.forEach((node, nodeId) => {
      node.dependencies.forEach(depId => {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(nodeId);
        }
      });
    });
  }

  /**
   * Get all nodes
   */
  getNodes(): DAGNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get node by ID
   */
  getNode(workOrderId: string): DAGNode | undefined {
    return this.nodes.get(workOrderId);
  }

  /**
   * Get all dependencies (transitive) for a node
   */
  getAllDependencies(workOrderId: string): Set<string> {
    const visited = new Set<string>();
    const dependencies = new Set<string>();
    
    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (!node) return;
      
      node.dependencies.forEach(depId => {
        dependencies.add(depId);
        dfs(depId);
      });
    };
    
    dfs(workOrderId);
    return dependencies;
  }

  /**
   * Get all dependents (transitive) for a node
   */
  getAllDependents(workOrderId: string): Set<string> {
    const visited = new Set<string>();
    const dependents = new Set<string>();
    
    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (!node) return;
      
      node.dependents.forEach(depId => {
        dependents.add(depId);
        dfs(depId);
      });
    };
    
    dfs(workOrderId);
    return dependents;
  }

  /**
   * Detect cycles in the DAG
   * Returns array of cycles found (each cycle is an array of work order IDs)
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      if (recStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId]);
        }
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (dfs(depId)) {
            return true;
          }
        }
      }

      recStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check all nodes
    this.nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    });

    return cycles;
  }

  /**
   * Check if DAG has cycles
   */
  hasCycles(): boolean {
    return this.detectCycles().length > 0;
  }

  /**
   * Topological sort using Kahn's algorithm
   * Returns work orders in dependency order (dependencies first)
   */
  topologicalSort(): WorkOrder[] {
    // Check for cycles first
    if (this.hasCycles()) {
      const cycles = this.detectCycles();
      const cycleInfo = cycles.map(cycle => 
        cycle.map(id => this.nodes.get(id)?.workOrder.data.workOrderNumber || id).join(' → ')
      ).join('; ');
      throw new Error(`Circular dependency detected: ${cycleInfo}`);
    }

    const sorted: WorkOrder[] = [];
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Calculate in-degree for each node
    this.nodes.forEach((node, nodeId) => {
      inDegree.set(nodeId, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(nodeId);
      }
    });

    // Process nodes with no dependencies
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = this.nodes.get(nodeId);
      
      if (node) {
        sorted.push(node.workOrder);

        // Reduce in-degree for dependents
        node.dependents.forEach(depId => {
          const currentInDegree = inDegree.get(depId) || 0;
          const newInDegree = currentInDegree - 1;
          inDegree.set(depId, newInDegree);

          if (newInDegree === 0) {
            queue.push(depId);
          }
        });
      }
    }

    // Check if all nodes were processed
    if (sorted.length !== this.nodes.size) {
      throw new Error('Topological sort failed: some nodes have unresolved dependencies');
    }

    return sorted;
  }

  /**
   * Get root nodes (nodes with no dependencies)
   */
  getRootNodes(): DAGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.dependencies.length === 0);
  }

  /**
   * Get leaf nodes (nodes with no dependents)
   */
  getLeafNodes(): DAGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.dependents.length === 0);
  }

  /**
   * Get critical path (longest path through the DAG)
   * @upgrade: Implement critical path calculation
   */
  getCriticalPath(): string[] {
    // @upgrade: Implement critical path algorithm
    // This would require calculating longest path considering durations
    return [];
  }

  /**
   * Get dependency depth for a node (how many levels of dependencies)
   */
  getDependencyDepth(workOrderId: string): number {
    const node = this.nodes.get(workOrderId);
    if (!node || node.dependencies.length === 0) {
      return 0;
    }

    return Math.max(...node.dependencies.map(depId => this.getDependencyDepth(depId))) + 1;
  }

  /**
   * Get visualization data for the DAG
   */
  getVisualizationData(): {
    nodes: Array<{ id: string; label: string; level: number }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      id: node.workOrderId,
      label: node.workOrder.data.workOrderNumber,
      level: this.getDependencyDepth(node.workOrderId),
    }));

    const edges: Array<{ from: string; to: string }> = [];
    this.nodes.forEach(node => {
      node.dependencies.forEach(depId => {
        edges.push({ from: depId, to: node.workOrderId });
      });
    });

    return { nodes, edges };
  }
}
