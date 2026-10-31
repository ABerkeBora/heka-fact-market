import React, { useEffect, useState } from "react";
import "./bsv.css";
const short = (x?: string) =>
  x ? x.slice(0, 10) + "…" + x.slice(-8) : "Not yet";
const clock = (n: number) =>
  new Date(n * 1000).toLocaleTimeString("en-GB", { timeZone: "Europe/Berlin" });
async function api(path: string, body?: unknown) {
  const r = await fetch(
    "/api/bsv/" + path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
export function BsvApp() {
  const [data, setData] = useState<any>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [goal, setGoal] = useState(
      "Create an ETH/USD market around the next reported price.",
    ),
    [details, setDetails] = useState(false);
  async function refresh() {
    try {
      setData(await api("state"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, []);
  async function action(name: string, body: unknown = {}) {
    setBusy(name);
    setError("");
    try {
      await api(name, body);
      await refresh();
    } catch (e: any) {
      setError(e.message);
      await refresh();
    } finally {
      setBusy("");
    }
  }
  const m = data.market,
    p = m?.policy,
    deposits = m?.deposits || [],
    walletReady = data.wallet?.status === "ready";
  return (
    <div className="bsv-shell" data-ui="relay-market">
      <header className="bsv-top">
        <a href="/" className="bsv-brand">
          Fact Market<span>Native BSV collateral</span>
        </a>
        <nav>
          <a href="/">Original</a>
          <a href="/next">Feed recipes</a>
          <span>BSV testnet</span>
        </nav>
      </header>
      <main className="bsv-main">
        <div className="bsv-title">
          <div>
            <p className="bsv-kicker">Source-bound prediction</p>
            <h1>A fixed question. Two funded sides.</h1>
            <p>
              Agents take an ETH/USD position with native test satoshis. The
              signed source determines which fixed beneficiary can collect.
            </p>
          </div>
          <button onClick={() => void refresh()} disabled={!!busy}>
            Refresh
          </button>
        </div>
        {error && (
          <div className="bsv-error" role="alert">
            {error}
          </div>
        )}
        <section className="bsv-grid">
          <div className="bsv-work">
            <div className="bsv-section-heading">
              <h2>
                {p
                  ? `Will ETH/USD exceed $${(p.thresholdCents / 100).toFixed(2)}?`
                  : "Create the market rule"}
              </h2>
              <span className="bsv-state">
                {m?.status?.replaceAll("_", " ") || "Not funded"}
              </span>
            </div>
            <label className="bsv-label" htmlFor="bsv-goal">
              Agent goal
            </label>
            <textarea
              id="bsv-goal"
              rows={2}
              maxLength={500}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={!!busy}
            />
            <div className="bsv-actions">
              <button onClick={() => void action("connect")} disabled={!!busy}>
                {busy === "connect" ? "Connecting…" : "Connect BSV wallet"}
              </button>
              <button
                className="bsv-primary"
                onClick={() => void action("propose", { goal })}
                disabled={!!busy || !walletReady}
              >
                {busy === "propose"
                  ? "Agent choosing rule…"
                  : "Propose with agent"}
              </button>
            </div>
            <div className="bsv-pool">
              <div>
                <span>YES stake</span>
                <strong>
                  {deposits.some(
                    (d: any) =>
                      d.role ===
                      (p?.userSide === "yes" ? "buyer" : "counterparty"),
                  )
                    ? "1,000"
                    : "0"}{" "}
                  <small>sats</small>
                </strong>
              </div>
              <div className="bsv-pool-rule">⇄</div>
              <div>
                <span>NO stake</span>
                <strong>
                  {deposits.some(
                    (d: any) =>
                      d.role ===
                      (p?.userSide === "no" ? "buyer" : "counterparty"),
                  )
                    ? "1,000"
                    : "0"}{" "}
                  <small>sats</small>
                </strong>
              </div>
              <div className="bsv-total">
                <span>Matched payout</span>
                <strong>
                  {deposits.length === 2 ? "1,900" : "—"} <small>sats</small>
                </strong>
              </div>
            </div>
            {p ? (
              <>
                <dl className="bsv-rules">
                  <div>
                    <dt>Agent position</dt>
                    <dd>{p.userSide.toUpperCase()} · 1,000 test sats</dd>
                  </div>
                  <div>
                    <dt>Trade closes</dt>
                    <dd>{clock(p.closesAt)} Berlin</dd>
                  </div>
                  <div>
                    <dt>Observation window</dt>
                    <dd>
                      {clock(p.observationStart)}–{clock(p.observationEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt>Source rule</dt>
                    <dd>
                      First accepted fresh Nodary ETH/USD observation. Equality
                      is NO.
                    </dd>
                  </div>
                  <div>
                    <dt>No qualifying result</dt>
                    <dd>Fixed split refund, with attestor cooperation</dd>
                  </div>
                </dl>
                <div className="bsv-actions">
                  <button
                    onClick={() => void action("fund-counterparty")}
                    disabled={!!busy}
                  >
                    Fund test counterparty · 5,000 sats
                  </button>
                  <button
                    className="bsv-primary"
                    onClick={() =>
                      void action(
                        m?.status === "blocked" ? "resume" : "authorize",
                      )
                    }
                    disabled={
                      !!busy || !["draft", "blocked"].includes(m.status)
                    }
                  >
                    {busy === "authorize"
                      ? "Agent funding…"
                      : "Start bounded BSV agent"}
                  </button>
                  {["waiting", "approval_pending", "payout_pending"].includes(
                    m.status,
                  ) && (
                    <button
                      onClick={() => void action("resolve")}
                      disabled={!!busy}
                    >
                      {busy === "resolve"
                        ? "Reconciling…"
                        : "Check result / resume"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="bsv-note">
                Connect a standard wallet on testnet, then ask the real local
                model for a bounded rule. No market or payment exists yet.
              </p>
            )}
            {m?.payout && (
              <div className="bsv-result">
                <h3>
                  {m.status === "refunded"
                    ? "Stakes refunded"
                    : "Matched pool paid"}
                </h3>
                <a href={m.payout.explorer} target="_blank" rel="noreferrer">
                  View BSV transaction · {short(m.payout.txid)}
                </a>
              </div>
            )}
            {m?.lastError && (
              <p className="bsv-note">Last observation: {m.lastError}</p>
            )}
          </div>
          <aside className="bsv-aside">
            <h2>Wallet and mandate</h2>
            <dl className="bsv-rules">
              <div>
                <dt>Standard wallet</dt>
                <dd>
                  {walletReady
                    ? "Connected · testnet"
                    : data.wallet?.reason || "Checking connection…"}
                </dd>
              </div>
              <div>
                <dt>Identity</dt>
                <dd className="bsv-mono">{short(data.wallet?.identity)}</dd>
              </div>
              <div>
                <dt>Collateral per side</dt>
                <dd>1,000 native test sats</dd>
              </div>
              <div>
                <dt>Settlement fee</dt>
                <dd>100 sats from the pool</dd>
              </div>
              <div>
                <dt>Oracle API fee</dt>
                <dd>0 · Nodary is free</dd>
              </div>
              <div>
                <dt>Mandate</dt>
                <dd>
                  {m?.mandate
                    ? "One deposit, one payout; max 6 observations"
                    : "Not authorized"}
                </dd>
              </div>
            </dl>
            <div className="bsv-trust">
              <h3>Who can release collateral?</h3>
              <p>
                One of the two fixed participants and an output-bound attestor
                must both sign. For a valid payout the agent requests the
                winner’s signature. The attestor first requires the original
                API3 response to pass a deployed EVM guard.
              </p>
              <p>
                This is a trusted relay, not native API3 verification on BSV.
                The attestor cannot spend alone, but collusion with a
                participant can misdirect a result. Refunds also require its
                cooperation.
              </p>
            </div>
            <p className="bsv-note">
              <strong>Local key ownership:</strong> this server owns both
              test-counterparty and attestor keys. Together they can bypass the
              application policy and spend the pool. Non-custodial track
              qualification is pending independent key ownership or a verified
              native covenant.
            </p>
            <button
              className="bsv-proof-toggle"
              onClick={() => setDetails(!details)}
            >
              {details ? "Hide" : "Inspect"} fixed policy and proof
            </button>
            {details && (
              <pre className="bsv-proof">
                {JSON.stringify(
                  {
                    policy: p,
                    guard: data.guard,
                    approval: m?.approval,
                    model: m?.llm,
                    trust: data.trust,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </aside>
        </section>
        <section className="bsv-trail">
          <h2>Payment trail</h2>
          {m?.events?.length ? (
            <ol>
              {m.events.map((e: any, i: number) => (
                <li key={i}>
                  <time>
                    {new Date(e.at).toLocaleTimeString("en-GB", {
                      timeZone: "Europe/Berlin",
                    })}
                  </time>
                  <span>{e.message}</span>
                  {(e.txid || e.transaction) && (
                    <a
                      href={
                        e.txid
                          ? `https://test.whatsonchain.com/tx/${e.txid}`
                          : `https://sepolia.basescan.org/tx/${e.transaction}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Transaction ↗
                    </a>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>No BSV collateral or payout transactions have been recorded.</p>
          )}
        </section>
        <p className="bsv-foot">
          Isolated local test roles; no external customer or profit claim.
          Existing market versions remain available at their original links.
        </p>
      </main>
    </div>
  );
}
