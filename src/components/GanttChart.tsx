import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { WorkOrder, WorkCenter } from '../reflow/types';
import './GanttChart.css';

interface GanttChartProps {
  workOrders: WorkOrder[];
  workCenters: WorkCenter[];
  originalWorkOrders?: WorkOrder[];
}

interface GanttBar {
  workOrder: WorkOrder;
  startX: number;
  width: number;
  workCenterIndex: number;
  color: string;
  colorSolid: string;
}

// Professional color palette for work centers
const WORK_CENTER_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // purple gradient
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // pink gradient
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // blue gradient
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // green gradient
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // orange gradient
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', // teal gradient
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // light gradient
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // soft gradient
];

// Fallback solid colors for browsers that don't support gradients in some contexts
const WORK_CENTER_COLORS_SOLID = [
  '#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea', '#ff9a9e',
];

export default function GanttChart({ workOrders, workCenters, originalWorkOrders = [] }: GanttChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5, 1, 2, 4
  
  const { bars, minDate, maxDate, workCenterMap } = useMemo(() => {
    if (workOrders.length === 0) {
      return { bars: [], minDate: DateTime.now(), maxDate: DateTime.now().plus({ days: 1 }), workCenterMap: new Map() };
    }

    // Create work center map
    const wcMap = new Map<string, { center: WorkCenter; index: number }>();
    workCenters.forEach((wc, index) => {
      wcMap.set(wc.docId, { center: wc, index });
    });

    // Parse all dates and find min/max
    const allDates: DateTime[] = [];
    workOrders.forEach(wo => {
      allDates.push(DateTime.fromISO(wo.data.startDate));
      allDates.push(DateTime.fromISO(wo.data.endDate));
    });
    workCenters.forEach(wc => {
      wc.data.maintenanceWindows.forEach(mw => {
        allDates.push(DateTime.fromISO(mw.startDate));
        allDates.push(DateTime.fromISO(mw.endDate));
      });
    });

    const min = allDates.length > 0 ? DateTime.min(...allDates)! : DateTime.now();
    const max = allDates.length > 0 ? DateTime.max(...allDates)! : DateTime.now();
    
    // Add padding
    const minDate = min.minus({ hours: 2 });
    const maxDate = max.plus({ hours: 2 });

    const totalMinutes = maxDate.diff(minDate, 'minutes').minutes;

    // Create bars
    const bars: GanttBar[] = workOrders.map(wo => {
      const startDate = DateTime.fromISO(wo.data.startDate);
      const endDate = DateTime.fromISO(wo.data.endDate);
      
      const startMinutes = startDate.diff(minDate, 'minutes').minutes;
      const durationMinutes = endDate.diff(startDate, 'minutes').minutes;
      
      const wcInfo = wcMap.get(wo.data.workCenterId);
      const workCenterIndex = wcInfo?.index ?? 0;
      const colorIndex = workCenterIndex % WORK_CENTER_COLORS.length;
      const color = wo.data.isMaintenance 
        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' // red gradient for maintenance
        : WORK_CENTER_COLORS[colorIndex];
      const colorSolid = wo.data.isMaintenance 
        ? '#ef4444'
        : WORK_CENTER_COLORS_SOLID[colorIndex];

      return {
        workOrder: wo,
        startX: (startMinutes / totalMinutes) * 100,
        width: (durationMinutes / totalMinutes) * 100,
        workCenterIndex,
        color,
        colorSolid,
      };
    });

    return { bars, minDate, maxDate, workCenterMap: wcMap };
  }, [workOrders, workCenters]);

  // Group bars by work center
  const barsByWorkCenter = useMemo(() => {
    const grouped = new Map<number, GanttBar[]>();
    bars.forEach(bar => {
      if (!grouped.has(bar.workCenterIndex)) {
        grouped.set(bar.workCenterIndex, []);
      }
      grouped.get(bar.workCenterIndex)!.push(bar);
    });
    return grouped;
  }, [bars]);

  // Generate time labels based on zoom level
  const timeLabels = useMemo(() => {
    const labels: { time: DateTime; position: number }[] = [];
    const totalMinutes = maxDate.diff(minDate, 'minutes').minutes;
    
    // Adjust interval based on zoom level
    // Zoom 0.5x: 8 hours, 1x: 4 hours, 2x: 2 hours, 4x: 1 hour
    const hourInterval = zoomLevel === 0.5 ? 8 : zoomLevel === 1 ? 4 : zoomLevel === 2 ? 2 : 1;
    
    let current = minDate.startOf('hour');
    while (current <= maxDate) {
      const position = (current.diff(minDate, 'minutes').minutes / totalMinutes) * 100;
      labels.push({ time: current, position });
      current = current.plus({ hours: hourInterval });
    }
    
    return labels;
  }, [minDate, maxDate, zoomLevel]);

  // Calculate minimum chart width based on zoom
  const chartMinWidth = useMemo(() => {
    const baseWidth = 800;
    return baseWidth * zoomLevel;
  }, [zoomLevel]);

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      if (prev >= 4) return prev;
      return prev === 0.5 ? 1 : prev === 1 ? 2 : 4;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      if (prev <= 0.5) return prev;
      return prev === 4 ? 2 : prev === 2 ? 1 : 0.5;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  if (workOrders.length === 0) {
    return <div className="gantt-empty">No work orders to display</div>;
  }

  return (
    <div className="gantt-chart">
      <div className="gantt-header">
        <h3>Production Schedule Gantt Chart</h3>
        <div className="gantt-zoom-controls">
          <button 
            className="zoom-button zoom-out" 
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0.5}
            title="Zoom Out"
          >
            −
          </button>
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <button 
            className="zoom-button zoom-in" 
            onClick={handleZoomIn}
            disabled={zoomLevel >= 4}
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
      
      <div className="gantt-container">
        {/* Y-axis: Work Centers */}
        <div className="gantt-y-axis">
          {workCenters.map((wc, index) => {
            const centerBars = barsByWorkCenter.get(index) || [];
            return (
              <div key={wc.docId} className="gantt-row-label">
                <div className="work-center-name">{wc.data.name}</div>
                <div className="work-center-count">{centerBars.length} order(s)</div>
              </div>
            );
          })}
        </div>

        {/* Chart Area */}
        <div className="gantt-chart-area" style={{ minWidth: `${chartMinWidth}px` }}>
          {/* Time scale */}
          <div className="gantt-time-scale">
            {/* Time labels */}
            {timeLabels.map((label, idx) => (
              <div
                key={idx}
                className="gantt-time-label"
                style={{ left: `${label.position}%` }}
              >
                {label.time.toFormat('MMM dd, HH:mm')}
              </div>
            ))}
          </div>

          {/* Grid lines */}
          <div className="gantt-grid">
            {timeLabels.map((_, idx) => (
              <div
                key={idx}
                className="gantt-grid-line"
                style={{ left: `${timeLabels[idx].position}%` }}
              />
            ))}
          </div>

          {/* Work center rows */}
          <div className="gantt-rows">
            {workCenters.map((wc, wcIndex) => {
              const centerBars = barsByWorkCenter.get(wcIndex) || [];
              
              // Get maintenance windows for this work center
              const maintenanceWindows = wc.data.maintenanceWindows.map(mw => {
                const startDate = DateTime.fromISO(mw.startDate);
                const endDate = DateTime.fromISO(mw.endDate);
                const totalMinutes = maxDate.diff(minDate, 'minutes').minutes;
                const startMinutes = startDate.diff(minDate, 'minutes').minutes;
                const durationMinutes = endDate.diff(startDate, 'minutes').minutes;
                
                return {
                  startX: (startMinutes / totalMinutes) * 100,
                  width: (durationMinutes / totalMinutes) * 100,
                  reason: mw.reason,
                };
              });

              return (
                <div key={wc.docId} className="gantt-row">
                  {/* Maintenance windows */}
                  {maintenanceWindows.map((mw, idx) => (
                    <div
                      key={idx}
                      className="gantt-maintenance-window"
                      style={{
                        left: `${mw.startX}%`,
                        width: `${mw.width}%`,
                      }}
                      title={mw.reason || 'Maintenance Window'}
                    />
                  ))}
                  
                  {/* Work order bars */}
                  {centerBars.map((bar) => {
                    const originalWo = originalWorkOrders.find(wo => wo.docId === bar.workOrder.docId);
                    const hasChanged = originalWo && (
                      originalWo.data.startDate !== bar.workOrder.data.startDate ||
                      originalWo.data.endDate !== bar.workOrder.data.endDate
                    );

                    return (
                      <div
                        key={bar.workOrder.docId}
                        className={`gantt-bar ${hasChanged ? 'gantt-bar-changed' : ''} ${bar.workOrder.data.isMaintenance ? 'gantt-bar-maintenance' : ''}`}
                        style={{
                          left: `${bar.startX}%`,
                          width: `${bar.width}%`,
                          backgroundColor: bar.color,
                        }}
                        title={`${bar.workOrder.data.workOrderNumber}\n${DateTime.fromISO(bar.workOrder.data.startDate).toFormat('MMM dd, HH:mm')} - ${DateTime.fromISO(bar.workOrder.data.endDate).toFormat('MMM dd, HH:mm')}\n${hasChanged ? '✓ Rescheduled' : ''}`}
                      >
                        <span className="gantt-bar-label">
                          {bar.workOrder.data.workOrderNumber}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="gantt-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: WORK_CENTER_COLORS[0] }} />
          <span>Production Orders</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-maintenance" />
          <span>Maintenance Orders</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-changed" />
          <span>Rescheduled Orders</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-maintenance-window" />
          <span>Maintenance Windows</span>
        </div>
      </div>
    </div>
  );
}

