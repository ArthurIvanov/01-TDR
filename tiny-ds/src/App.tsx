import { useState } from 'react'
import { Button } from '@/components'
import { getTheme, toggleTheme, type Theme } from '@/theme/theme'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : getTheme(),
  )

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">tiny-ds</p>
        <h1 className="app__title">Design system playground</h1>
        <p className="app__lead">
          Colors from plugin drop-in <code>figma-colors.css</code>. Theme via{' '}
          <code>data-theme=&quot;dark&quot;</code>.
        </p>
      </header>

      <section className="app__section" aria-labelledby="button-demo">
        <h2 id="button-demo" className="app__section-title">
          Button
        </h2>
        <div className="app__row">
          <Button onClick={() => setCount((value) => value + 1)}>
            Primary · {count}
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost" size="sm">
            Ghost sm
          </Button>
          <Button disabled>Disabled</Button>
          <Button
            variant="secondary"
            onClick={() => setThemeState(toggleTheme())}
          >
            Theme · {theme}
          </Button>
        </div>
      </section>
    </main>
  )
}

export default App
