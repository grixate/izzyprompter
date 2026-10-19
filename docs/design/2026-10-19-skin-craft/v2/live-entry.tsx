import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import JogLabPage from '../../../../src/pages/JogLabPage'
import '../../../../src/styles.css'
import '../../../../src/product/product.css'
import '../../../../src/product/skins.css'
createRoot(document.getElementById('root')!).render(<StrictMode><JogLabPage /></StrictMode>)
