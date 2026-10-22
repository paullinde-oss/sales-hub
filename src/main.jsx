import React from 'react'
import ReactDOM from 'react-dom/client'
import SalesHub from './SalesHub'
import { completeDropboxAuth } from './sales/dropbox'

// Finish Dropbox sign-in (if we just came back from Dropbox) before the app renders
completeDropboxAuth().catch(console.error).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <SalesHub />
    </React.StrictMode>
  )
})
