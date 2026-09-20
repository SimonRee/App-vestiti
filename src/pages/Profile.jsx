import { ArrowLeft, LogOut, UserRound } from 'lucide-react'

function Profile({ email, onBack, onLogout }) {
  return (
    <main className="page profile-page">
      <button
        className="profile-back"
        type="button"
        onClick={onBack}
        aria-label="Torna indietro"
      >
        <ArrowLeft />
      </button>

      <header className="profile-header">
        <div className="profile-avatar">
          <UserRound />
        </div>

        <p className="page-label">Account</p>
        <h1>Profilo</h1>
      </header>

      <section className="profile-section">
        <p className="profile-field-label">Email</p>
        <p className="profile-email">{email}</p>
      </section>

      <button
        className="profile-logout"
        type="button"
        onClick={onLogout}
      >
        <LogOut />
        <span>Esci dall’account</span>
      </button>
    </main>
  )
}

export default Profile