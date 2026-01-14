import { useState } from 'react'
import './App.css'
import { ReflowService } from './reflow/reflow.service'
import { ReflowInput, ReflowResult } from './reflow/types'
import ProfessionalGanttChart from './components/ProfessionalGanttChart'
import DAGVisualization from './components/DAGVisualization'
import defaultScenario from '../sample-data/scenario-4-edge-cases.json'

function App() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(defaultScenario, null, 2))
  const [result, setResult] = useState<ReflowResult | null>(null)
  const [originalInput, setOriginalInput] = useState<ReflowInput | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReflow = () => {
    try {
      setError(null)
      const input: ReflowInput = JSON.parse(jsonInput)
      setOriginalInput(input)
      
      const reflowService = new ReflowService()
      const reflowResult = reflowService.reflow(input)
      setResult(reflowResult)
    } catch (err) {
      console.error('Reflow error:', err)
      setError(err instanceof Error ? err.message : 'Invalid JSON or processing error')
      setResult(null)
      setOriginalInput(null)
    }
  }

  return (
    <div className="app">
      <div className="top-link">
        <a href="https://NaoLogic.LinhTruong.Com" target="_blank" rel="noopener noreferrer">
          NaoLogic.LinhTruong.Com
        </a>
      </div>
      <h1>Production Schedule Reflow</h1>
      <p className="subtitle">Enter JSON data to reschedule work orders</p>
      
      <div className="input-section">
        <textarea
          className="json-input"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"workOrders": [...], "workCenters": [...], "manufacturingOrders": [...]}'
        />
        <button onClick={handleReflow} className="reflow-button">
          Run Reflow
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && originalInput && (
        <div className="result-section">
          <h2>Results</h2>
          <div className="explanation">{result.explanation}</div>
          
          {/* DAG Visualization */}
          <DAGVisualization workOrders={originalInput.workOrders} />
          
          {/* Professional Gantt Chart */}
          <ProfessionalGanttChart
            workOrders={result.updatedWorkOrders}
            workCenters={originalInput.workCenters}
            originalWorkOrders={originalInput.workOrders}
          />
          
          {result.dagInfo && (
            <div className="dag-info">
              <h3>Dependency Graph Analysis</h3>
              <div className="dag-stats">
                <div className="dag-stat">
                  <strong>Root Nodes:</strong> {result.dagInfo.rootNodes.length} 
                  {result.dagInfo.rootNodes.length > 0 && (
                    <span className="dag-nodes"> ({result.dagInfo.rootNodes.join(', ')})</span>
                  )}
                </div>
                <div className="dag-stat">
                  <strong>Leaf Nodes:</strong> {result.dagInfo.leafNodes.length}
                  {result.dagInfo.leafNodes.length > 0 && (
                    <span className="dag-nodes"> ({result.dagInfo.leafNodes.join(', ')})</span>
                  )}
                </div>
                {result.dagInfo.hasCycles && (
                  <div className="dag-error">
                    <strong>⚠️ Cycles Detected:</strong> {result.dagInfo.cycles.length} cycle(s) found
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="changes">
            <h3>Changes ({result.changes.length})</h3>
            {result.changes.length > 0 ? (
              <ul>
                {result.changes.map((change) => (
                  <li key={change.workOrderId}>
                    <strong>{change.workOrderNumber}:</strong> {change.reason}
                    <br />
                    <small>
                      {change.oldStartDate} → {change.newStartDate}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No changes required.</p>
            )}
          </div>

          <div className="output">
            <h3>Updated Work Orders</h3>
            <pre>{JSON.stringify(result.updatedWorkOrders, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
