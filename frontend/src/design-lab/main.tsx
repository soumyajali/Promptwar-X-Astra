// Standalone entry for the Design Lab (used to build a single shareable HTML file).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DesignLab } from './Lab'

createRoot(document.getElementById('root')!).render(<StrictMode><DesignLab /></StrictMode>)
