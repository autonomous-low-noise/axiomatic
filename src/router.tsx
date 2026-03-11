import { createBrowserRouter } from 'react-router-dom'
import { OverviewPage } from './pages/OverviewPage'
import { ReaderPage } from './pages/ReaderPage'
import { LoopPage } from './pages/LoopPage'
import { SnipsPage } from './pages/SnipsPage'
import { StatsPage } from './pages/StatsPage'
import { Layout } from './components/Layout'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/read/:slug', element: <ReaderPage /> },
      { path: '/loop/:slug', element: <LoopPage /> },
      { path: '/snips', element: <SnipsPage /> },
      { path: '/stats', element: <StatsPage /> },
    ],
  },
])
