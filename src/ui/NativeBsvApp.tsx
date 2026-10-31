import React, { useEffect, useState } from "react";
import "./bsv.css";
const short = (v?: string) =>
  v ? v.slice(0, 10) + "…" + v.slice(-8) : "Not yet";
const time = (v: number) =>
  new Date(v * 1000).toLocaleTimeString("en-GB", { timeZone: "Europe/Berlin" });
async function api(name: string, body?: unknown) {
  const r = await fetch(
    "/api/bsv/native/" + name,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Native request failed");
  return data;
}
export function NativeBsvApp() {
  const [data, setData] = useState<any>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [goal, setGoal] = useState(
      "Create an ETH/USD market around the next reported price.",
    ),
    [proof, setProof] = useState(false),
    [envelope, setEnvelope] = useState(""),
    [check, setCheck] = useState<any>(null);
  async function refresh() {
    try {
      setData(await api("state"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);
  async function action(name: string) {
    setBusy(name);
    setError("");
    try {
      await api(name, name === "propose" ? { goal } : {});
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function judge() {
    setBusy("check");
    setError("");
    setCheck(null);
    try {
      setCheck(await api("check", { envelope: JSON.parse(envelope) }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const m = data.market,
    p = m?.policy,
    funded = !!m?.funding,
    paid = !!m?.payout;
  return (
    <div className="bsv-shell" data-ui="native-market">
      <header className="bsv-top">
        <a className="bsv-brand" href="/">
          Fact Market<span>Native signed-source contract</span>
        </a>
        <nav>
          <a href="/">Original</a>
          <a href="/next">Feed recipes</a>
          <a href="/bsv">Relay version</a>
          <span>BSV testnet</span>
        </nav>
      </header>
      <main className="bsv-main">
        <div className="bsv-title">
          <div>
            <p className="bsv-kicker">Native contract · fixed recipients</p>
            <h1>A fixed rule for two native stakes.</h1>
            <p>
              The BSV contract checks the original API3 signature, ETH/USD
              price, observation window and exact payout outputs. No relayer key
              can choose the winner.
            </p>
          </div>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
        {error && (
          <div className="bsv-error" role="alert">
            {error}
          </div>
        )}
        {data.resourceGate?.status === "blocked" && (
          <div className="bsv-error" role="status">
            {data.resourceGate.reason}
          </div>
        )}
        <section className="bsv-grid">
          <div className="bsv-work">
            <div className="bsv-section-heading">
              <h2>
                {m
                  ? `Will ETH/USD exceed $${m.thresholdUsd}?`
                  : "Choose the bounded market"}
              </h2>
              <span className="bsv-state">
                {m?.status?.replaceAll("_", " ") || "Not prepared"}
              </span>
            </div>
            <label className="bsv-label" htmlFor="native-goal">
              Agent goal
            </label>
            <textarea
              id="native-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={500}
              disabled={!!m || !!busy}
            />
            <div className="bsv-actions">
              <button
                className="bsv-primary"
                onClick={() => void action("propose")}
                disabled={!!busy || !!m}
              >
                {busy === "propose" ? "Agent choosing…" : "Propose native rule"}
              </button>
            </div>
            <div className="bsv-pool">
              <div>
                <span>Buyer committed</span>
                <strong>
                  {funded ? "1,000" : "0"} <small>sats</small>
                </strong>
              </div>
              <div className="bsv-pool-rule">⇄</div>
              <div>
                <span>Counterparty committed</span>
                <strong>
                  {funded ? "1,000" : "0"} <small>sats</small>
                </strong>
              </div>
              <div className="bsv-total">
                <span>Protected pool</span>
                <strong>
                  {paid ? "0" : funded ? "2,000" : "—"} <small>sats</small>
                </strong>
              </div>
            </div>
            {p ? (
              <>
                <dl className="bsv-rules">
                  <div>
                    <dt>Agent position</dt>
                    <dd>{m.userSide.toUpperCase()} · fixed 1,000 sats</dd>
                  </div>
                  <div>
                    <dt>Observation window</dt>
                    <dd>
                      {time(p.validFrom)}–{time(p.validTo)} Berlin
                    </dd>
                  </div>
                  <div>
                    <dt>Predicate</dt>
                    <dd>ETH/USD &gt; ${m.thresholdUsd}; equality is NO</dd>
                  </div>
                  <div>
                    <dt>Refund lock time</dt>
                    <dd>
                      {time(p.refundAfter)} · fixed 1,000 / 1,000 sats; chain
                      median time must pass
                    </dd>
                  </div>
                  <div>
                    <dt>Native verification</dt>
                    <dd>
                      Original EIP-191 signature, exact request and JSON source
                      timestamp; fixed winning output
                    </dd>
                  </div>
                </dl>
                <div className="bsv-actions">
                  <button
                    onClick={() => void action("prepare")}
                    disabled={
                      !!busy ||
                      data.resourceGate?.status === "blocked" ||
                      !["draft", "preparing"].includes(m.status)
                    }
                  >
                    {busy === "prepare"
                      ? "Preparing signatures…"
                      : "Prepare 1,000-sat mandate"}
                  </button>
                  <button
                    className="bsv-primary"
                    onClick={() => void action("fund")}
                    disabled={
                      !!busy ||
                      !["awaiting_sponsor", "funding"].includes(m.status)
                    }
                  >
                    {busy === "fund"
                      ? "Agent funding…"
                      : m.status === "funding"
                        ? "Reconcile existing funding"
                        : "Start native agent"}
                  </button>
                  {[
                    "waiting",
                    "claim_pending",
                    "refund_pending",
                    "refund_not_final",
                    "node_policy_blocked",
                  ].includes(m.status) && (
                    <button
                      onClick={() => void action("resolve")}
                      disabled={!!busy}
                    >
                      {m.activeIntent === "refund"
                        ? "Reconcile fixed refund"
                        : "Check result / resume"}
                    </button>
                  )}
                  {m.status === "node_policy_blocked" &&
                    Date.now() / 1000 >= p.refundAfter && (
                      <button
                        onClick={() => void action("refund")}
                        disabled={
                          !!busy || Date.now() / 1000 >= m.mandate.expiry
                        }
                      >
                        Return fixed stakes
                      </button>
                    )}
                </div>
                {m.status === "awaiting_sponsor" && (
                  <p className="bsv-note">
                    Both participant inputs are signed. The independent test fee
                    sponsor reviews and co-signs the initial funding plan before
                    this agent starts.
                  </p>
                )}
              </>
            ) : (
              <p className="bsv-note">
                One real local model call selects YES/NO and a permitted
                threshold offset. A deterministic validator fixes amounts,
                source, recipients and timing before funding.
              </p>
            )}
            {data.pendingFunding && (
              <div className="bsv-result">
                <h3>Funding broadcast pending</h3>
                <p>
                  Network acceptance is unverified. The existing signed
                  transaction is frozen; reconciliation cannot create another
                  deposit.
                </p>
                <a
                  href={
                    "https://test.whatsonchain.com/tx/" +
                    data.pendingFunding.txid
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(data.pendingFunding.txid)}
                </a>
              </div>
            )}
            {(m?.status === "node_policy_blocked" ||
              (!paid && m?.activeIntent === "refund")) && (
              <div className="bsv-error">
                The original claim was rejected by public nodes’ execution
                limits. No native payout or refund is recorded. The timed refund
                is awaiting network acceptance; its Script may also face
                execution limits.
              </div>
            )}
            {m?.funding && (
              <div className="bsv-result">
                <h3>Native contract funded</h3>
                <p>Network-visible; block confirmation is separate.</p>
                <a href={m.funding.explorer} target="_blank" rel="noreferrer">
                  Funding · {short(m.funding.txid)}
                </a>
              </div>
            )}
            {paid && (
              <div className="bsv-result">
                <h3>
                  {m.status === "refunded"
                    ? "Fixed stakes refunded"
                    : "Native outcome paid"}
                </h3>
                <a href={m.payout.explorer} target="_blank" rel="noreferrer">
                  Payout · {short(m.payout.txid)}
                </a>
              </div>
            )}
            {m?.status === "refund_not_final" && (
              <p className="bsv-note">
                The fixed refund is signed and locally verified. At its last
                attempt, chain median time had not reached its lock time. Refund
                Script admission is still unverified. No refund payment is
                recorded; automatic retries are paused.
              </p>
            )}
            {m?.lastError && (
              <p className="bsv-note">Last check: {m.lastError}</p>
            )}
          </div>
          <aside className="bsv-aside">
            <h2>What is enforced?</h2>
            <dl className="bsv-rules">
              <div>
                <dt>Contract stake cap</dt>
                <dd>2,000 native test sats</dd>
              </div>
              <div>
                <dt>Oracle charge</dt>
                <dd>0 · Nodary is free</dd>
              </div>
              <div>
                <dt>Large-script funding fee</dt>
                <dd>6,000 test sats · separate fee sponsor</dd>
              </div>
              <div>
                <dt>Claim fee cap</dt>
                <dd>100 sats · outside protected pool</dd>
              </div>
              <div>
                <dt>Keys controlling pool</dt>
                <dd>No attestor key or platform withdrawal branch</dd>
              </div>
            </dl>
            <div className="bsv-trust">
              <h3>Exact source. Fixed outputs.</h3>
              <p>
                The compiled contract computes Keccak and EIP-191 over the
                original response and checks the pinned Airnode public key. It
                parses the exact price and source timestamp and enforces the
                complete winning payout.
              </p>
              <p>
                The first valid contract spend wins. A qualifying window
                observation can still compete with a matured refund until one
                spend is accepted; this is not an exact-time quote or a
                current-clock freshness guarantee.
              </p>
              <p>
                Test roles are local, not independent customers. The upstream
                source can still be wrong. The experimental contract is large
                and has local VM tests, not a production security audit.
              </p>
            </div>
            <button
              className="bsv-proof-toggle"
              onClick={() => setProof(!proof)}
            >
              {proof ? "Hide" : "Inspect"} native policy and proof
            </button>
            {proof && (
              <pre className="bsv-proof">
                {JSON.stringify(
                  {
                    policy: p,
                    policyHash: m?.policyHash,
                    contract: m?.plan?.contractInfo,
                    model: m?.llm
                      ? {
                          model: m.llm.model,
                          realCall: m.llm.realCall,
                          durationMs: m.llm.durationMs,
                          chosenSide: m.llm.suggestion.side,
                          chosenOffsetBps: m.llm.suggestion.thresholdOffsetBps,
                        }
                      : null,
                    funding: m?.funding,
                    payout: m?.payout,
                  },
                  null,
                  2,
                )}
              </pre>
            )}
          </aside>
        </section>
        <section className="bsv-trail">
          <h2>Native payment trail</h2>
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
                  {e.txid && (
                    <a
                      href={"https://test.whatsonchain.com/tx/" + e.txid}
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
            <p>No native contract funding or payout is recorded.</p>
          )}
        </section>
        <section className="bsv-trail">
          <h2>Check an original signed response</h2>
          <p>
            This runs the configured immutable policy’s native Script locally.
            It cannot sign, broadcast or move collateral.
          </p>
          <label className="bsv-label" htmlFor="native-envelope">
            Signed response JSON
          </label>
          <textarea
            id="native-envelope"
            rows={5}
            value={envelope}
            onChange={(e) => setEnvelope(e.target.value)}
            placeholder='{"timestamp":"…","data":"…","signature":"0x…"}'
          />
          <div className="bsv-actions">
            <button
              onClick={() =>
                setEnvelope(
                  JSON.stringify(
                    data.judgeSample ||
                      m?.finalObservation?.envelope ||
                      m?.initialObservation?.envelope,
                    null,
                    2,
                  ),
                )
              }
              disabled={!m || !!busy}
            >
              Load captured response
            </button>
            <button
              onClick={() => void judge()}
              disabled={!m || !envelope || !!busy}
            >
              {busy === "check" ? "Executing native Script…" : "Check response"}
            </button>
          </div>
          {check && (
            <p
              className={check.accepted ? "bsv-result" : "bsv-error"}
              role="status"
            >
              {check.accepted ? "Accepted" : "Rejected"} · {check.reason}.
              Collateral unchanged.
            </p>
          )}
        </section>
        <p className="bsv-foot">
          Isolated /bsv/native policy, intents and deployment. Original,
          feed-recipe and relay versions preserve their own evidence.
        </p>
      </main>
    </div>
  );
}
