import { FactoryCanvas } from './scene/FactoryCanvas'
import { AssetList } from './ui/AssetList'
import { CameraToolbar, InspectorPanel } from './ui/InspectorPanel'
import { KpiCards } from './ui/KpiCards'
import { ProcessFlow } from './ui/ProcessFlow'
import { SceneLabels } from './ui/SceneLabels'
import { TopBar } from './ui/TopBar'

export function App() {
  return (
    <div className="app">
      <div className="scene">
        <FactoryCanvas />
      </div>
      <div className="overlay">
        <SceneLabels />
        <TopBar />
        <KpiCards />
        <CameraToolbar />
        <div className="right-column">
          <InspectorPanel />
          <AssetList />
        </div>
        <ProcessFlow />
      </div>
    </div>
  )
}
