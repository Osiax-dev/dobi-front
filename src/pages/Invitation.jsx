import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errText } from '../api';
import { useAuth } from '../auth';

export default function Invitation() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const accept = useMutation({
    mutationFn: () => api(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
    onSuccess: (data) => navigate(`/organizations/${data.organization_id}`, { replace: true }),
  });
  if (loading) return <main className="mx-auto max-w-lg p-8">Chargement…</main>;
  return <main className="mx-auto max-w-lg p-6 sm:py-16">
    <section className="panel space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-forest/60">DOBI · Invitation</p>
      <h1 className="text-2xl font-bold">Rejoindre une organisation</h1>
      {!user ? <>
        <p>Pour accepter cette invitation, connectez-vous avec l’adresse e-mail qui l’a reçue. Si vous n’avez pas encore de compte, créez-en un puis ouvrez à nouveau le lien d’invitation.</p>
        <div className="flex flex-wrap gap-3"><Link className="btn" to={`/login?next=${encodeURIComponent(`/invitations/${token}`)}`}>Se connecter</Link><Link className="btn-ghost" to={`/register?next=${encodeURIComponent(`/invitations/${token}`)}`}>Créer un compte</Link></div>
      </> : <>
        <p>Connecté en tant que <strong>{user.email}</strong>. Acceptez l’invitation pour rejoindre l’organisation.</p>
        {accept.isError && <p className="error">{errText(accept.error)}</p>}
        <button className="btn" disabled={accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? 'Validation…' : 'Accepter l’invitation'}</button>
      </>}
      <Link to="/" className="block text-sm underline">Retour à DOBI</Link>
    </section>
  </main>;
}
