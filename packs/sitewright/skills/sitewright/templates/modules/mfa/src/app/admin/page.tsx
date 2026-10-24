import { redirect } from 'next/navigation';
import { migrate, query } from '@/lib/db';
import { adminCount, currentAdmin } from '@/lib/admin';
import { SiteHeader } from '@/components/SiteHeader';
import { People, type Person } from '@/components/admin/People';
//#if publishing
import { allReleases, latestRelease } from '@/lib/releases';
import { ReleasePublisher } from '@/components/admin/ReleasePublisher';
import { VersionList, type VersionItem } from '@/components/admin/VersionList';
//#endif
//#if testers
import { Testers, type TesterItem } from '@/components/admin/Testers';
import { listTesters } from '@/lib/testers';
//#endif

export const dynamic = 'force-dynamic';

const when = (d: string | Date) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const whenTime = (d: string | Date) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The __AREA__ area. Its own accounts, each with a password and an authenticator code (lib/admin.ts) - separate from the
 * shared password that opens the private pages, because what is done here (people, versions) deserves a named account.
 */
export default async function AdminHome() {
  await (await import('@/lib/admin')).requireGate();
  await migrate();
  const admin = await currentAdmin();
  if (!admin) redirect((await adminCount()) === 0 ? '/admin/setup' : '/admin/login');

  const users = await query<{ username: string; name: string; created_at: string; created_by: string; last_sign_in: string | null }>(
    `SELECT username, name, created_at, created_by, last_sign_in FROM admin_users ORDER BY created_at`,
  );
  const activity = await query<{ at: string; username: string | null; action: string; detail: string; ip: string | null }>(
    `SELECT at, username, action, detail, ip FROM admin_activity ORDER BY at DESC LIMIT 40`,
  );
  const names = new Map(users.map((u) => [u.username, u.name]));
  const people: Person[] = users.map((u) => ({
    username: u.username,
    name: u.name,
    added: when(u.created_at),
    by: u.created_by,
    lastSignIn: u.last_sign_in ? whenTime(u.last_sign_in) : null,
    you: u.username === admin.username,
  }));

  //#if publishing
  const [releases, latest] = await Promise.all([allReleases(), latestRelease()]);
  const versions: VersionItem[] = releases.map((r) => ({
    versionCode: r.version_code,
    versionName: r.version_name,
    releaseName: r.release_name,
    notes: r.notes,
    fileName: r.file_name,
    sizeMb: (Number(r.size_bytes) / 1048576).toFixed(1),
    when: when(r.published_at),
    by: r.published_by,
    minSdk: r.min_sdk,
    model: r.detection_model,
    hidden: r.hidden,
    latest: latest?.version_code === r.version_code,
    channel: r.channel === 'testing' ? 'testing' : 'stable',
    onLanding: r.on_landing,
    kind: r.kind,
  }));
  const top = releases[0];
  const nextHint = top ? `It must have a higher build number than ${top.version_code} (${top.version_name}).` : 'Give it a version name and a build number.';
  //#endif
  //#if testers
  const testerRows = await listTesters();
  const testers: TesterItem[] = testerRows.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    added: when(t.created_at),
    by: t.created_by,
    lastSeen: t.last_seen_at ? whenTime(t.last_seen_at) : null,
    off: !!t.revoked_at,
    locked: !!t.locked_until && new Date(t.locked_until).getTime() > Date.now(),
  }));
  //#endif

  return (
    <>
      <SiteHeader active="__ADMIN_NAV_ID__" signOut="/api/admin/logout" sub="__AREA_LOWER__" />
      <main className="wrap admin">
        <section className="hero">
          <h1 className="hero-title">__AREA__</h1>
          <p className="hero-sub">
            Signed in as {admin.name}.
            {/*#if publishing*/}
            {' '}A version published here is offered to every __DEVICE__ that asks for updates, and can be shown on the{' '}
            <a className="link" href="/">home page</a>.
            {/*#else*/}
            {' '}Add the people who may manage __BRAND__; every sign-in and change is recorded below.
            {/*#endif*/}
          </p>
        </section>

        {/*#if publishing*/}
        <ReleasePublisher nextHint={nextHint} />
        <VersionList versions={versions} />
        {/*#endif*/}
        {/*#if testers*/}
        <Testers testers={testers} />
        {/*#endif*/}
        <People people={people} />

        <div className="card pad">
          <h2 className="card-h">Recent activity</h2>
          <div className="table-scroll">
            <table className="activity">
              <tbody>
                {activity.map((a, i) => (
                  <tr key={i}>
                    <td className="mono">{whenTime(a.at)}</td>
                    <td>{a.username ? names.get(a.username) ?? a.username : <span className="muted">-</span>}</td>
                    <td>{a.action}{a.detail ? <span className="muted"> · {a.detail}</span> : null}</td>
                    <td className="mono muted">{a.ip ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
