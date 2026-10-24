import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { migrate, query } from '@/lib/db';
import { otpauthUrl, pendingEnrollToken, tokenHash } from '@/lib/admin';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';

/** Scan the code with an authenticator app, then prove it with the first 6 digits. */
export default async function AdminEnroll({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await (await import('@/lib/admin')).requireGate();
  await migrate();
  const token = await pendingEnrollToken();
  if (!token) redirect('/admin/login');
  const row = (await query<{ pending_username: string | null; pending_totp: string | null }>(
    `SELECT pending_username, pending_totp FROM admin_invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash(token)],
  ))[0];
  if (!row?.pending_username || !row.pending_totp) redirect('/admin/login');
  const { error } = await searchParams;
  const url = otpauthUrl(row.pending_username, row.pending_totp);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#04140f', light: '#e9f1f5' } });
  return (
    <AuthCard step="Authenticator" title="Add __ISSUER__ to your authenticator" error={error}>
      <p className="muted small">
        In Google Authenticator, Microsoft Authenticator or any TOTP app, tap <b>+</b> and scan this. You will need
        a code from it every time you sign in.
      </p>
      <img className="qr" src={qr} alt="Authenticator QR code" width={220} height={220} />
      <p className="muted small">Cannot scan? Enter this key: <span className="mono secret">{row.pending_totp.replace(/(.{4})/g, '$1 ').trim()}</span></p>
      <form method="post" action="/api/admin/enroll" className="login-form">
        <input name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="Code from the app"
          autoComplete="one-time-code" autoFocus required className="code-input" />
        <button className="btn primary block" type="submit">Confirm and finish</button>
      </form>
    </AuthCard>
  );
}
