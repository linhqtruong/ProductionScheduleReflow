import { useMemo, useState } from 'react';
import { ReactGanttChart, Task } from '@jaeungkim/gantt-chart';
import { WorkOrder, WorkCenter } from '../reflow/types';
import './ProfessionalGanttChart.css';

interface ProfessionalGanttChartProps {
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  originalWorkOrders?: WorkOrder[];
}

/**
 * Professional Gantt Chart using @jaeungkim/gantt-chart library
 * Converts WorkOrders to the library's Task format
 */
export default function ProfessionalGanttChart({ 
  workOrders, 
  workCenters,
  originalWorkOrders = [] 
}: ProfessionalGanttChartProps) {
  const [scale, setScale] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [zoomLevel, setZoomLevel] = useState(1);

  // Convert work orders to tasks format
  const tasks = useMemo((): Task[] => {
    if (workOrders.length === 0) {
      return [];
    }

    // Create work center map for grouping
    const workCenterMap = new Map<string, WorkCenter>();
    workCenters.forEach(wc => {
      workCenterMap.set(wc.docId, wc);
    });

    // Convert work orders to tasks
    return workOrders.map((wo, index) => {
      const workCenter = workCenterMap.get(wo.data.workCenterId);
      const workCenterName = workCenter?.data.name || 'Unknown';
      
      // Create task name with work order number and work center
      const taskName = `${wo.data.workOrderNumber} (${workCenterName})`;
      
      // Convert dependencies
      const dependencies = wo.data.dependsOnWorkOrderIds.map(depId => ({
        targetId: depId,
        type: 'FS' as const, // Finish-to-Start dependency
      }));

      return {
        id: wo.docId,
        name: taskName,
        startDate: wo.data.startDate, // Already in ISO format
        endDate: wo.data.endDate, // Already in ISO format
        parentId: null, // @upgrade: Support hierarchical grouping by work center
        sequence: (index + 1).toString(),
        dependencies: dependencies.length > 0 ? dependencies : undefined,
      };
    });
  }, [workOrders, workCenters]);

  if (workOrders.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
        No work orders to display
      </div>
    );
  }

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return (
    <div style={{ margin: '2rem 0' }}>
      <div className="gantt-chart-header">
        <h3 style={{ margin: 0, color: '#212529', fontWeight: 600 }}>
          Production Schedule Gantt Chart
        </h3>
        <div className="gantt-controls">
          <div className="scale-selector">
            <label htmlFor="scale-select" style={{ marginRight: '0.5rem', fontSize: '0.875rem', color: '#6C757D' }}>
              Scale:
            </label>
            <select
              id="scale-select"
              value={scale}
              onChange={(e) => setScale(e.target.value as 'day' | 'week' | 'month' | 'year')}
              className="scale-select"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div className="zoom-controls">
            <button
              className="zoom-button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              title="Zoom Out"
            >
              −
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button
              className="zoom-button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              title="Zoom In"
            >
              +
            </button>
            <button
              className="zoom-button zoom-reset"
              onClick={handleResetZoom}
              title="Reset Zoom"
            >
              ⟲
            </button>
          </div>
        </div>
      </div>
      <div 
        className="gantt-chart-wrapper"
        style={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          overflow: 'auto',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          position: 'relative',
        }}
      >
        <div 
          className="gantt-chart-zoom-container"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            width: `${100 / zoomLevel}%`,
            minHeight: `${700 / zoomLevel}px`,
          }}
        >
          <ReactGanttChart
            tasks={tasks}
            height={700 / zoomLevel}
            width="100%"
            theme="light"
            defaultScale={scale}
            onTasksChange={(updatedTasks) => {
              // @upgrade: Handle task changes (drag/resize) if needed
              console.log('Tasks updated:', updatedTasks);
            }}
          />
        </div>
      </div>
      <div style={{ 
        marginTop: '1rem', 
        padding: '1rem', 
        backgroundColor: '#f7fafc', 
        borderRadius: '4px',
        fontSize: '0.875rem',
        color: '#4a5568',
        border: '1px solid #e2e8f0',
      }}>
        <strong>Features:</strong> 
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li>Drag to move tasks, resize by dragging edges</li>
          <li><strong>Zoom controls above chart</strong> - Use + / - buttons to zoom in/out (50% - 300%) for better name visibility</li>
          <li><strong>Scale selector</strong> - Change time scale (Day/Week/Month/Year) to adjust the timeline view</li>
          <li>Dependency arrows show relationships between work orders</li>
          <li>Scroll horizontally to pan through the timeline</li>
        </ul>
      </div>
    </div>
  );
}
