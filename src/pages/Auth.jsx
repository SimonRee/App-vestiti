import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Auth.css'

function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(error.message)
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) {
        setMessage(error.message)
      } else if (!data.session) {
        setMessage(
          'Account creato. Controlla la tua email per confermare la registrazione.',
        )
      }
    }

    setLoading(false)
  }

  function changeMode() {
    setIsLogin((currentValue) => !currentValue)
    setMessage('')
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">ARMARIUM</p>

        <h1>{isLogin ? 'Accedi' : 'Crea account'}</h1>

        <p className="auth-description">
          {isLogin
            ? 'Accedi per visualizzare il tuo guardaroba.'
            : 'Crea il tuo spazio personale.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="nome@email.com"
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="Almeno 6 caratteri"
              minLength="6"
              required
            />
          </label>

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Attendi...'
              : isLogin
                ? 'Accedi'
                : 'Registrati'}
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <button
          className="auth-switch"
          type="button"
          onClick={changeMode}
        >
          {isLogin
            ? 'Non hai un account? Registrati'
            : 'Hai già un account? Accedi'}
        </button>
      </section>
    </main>
  )
}

export default Auth