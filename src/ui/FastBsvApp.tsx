import React, { useEffect, useState } from "react";
import "./bsv.css";
const short = (v?: string) =>
  v ? v.slice(0, 10) + "…" + v.slice(-8) : "Not yet";
const time = (v?: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? new Date(v * 1000).toLocaleTimeString("en-GB", {
        timeZone: "Europe/Berlin",
      })
    : "—";
const amount = (v: number) => v.toLocaleString("en-GB");
async function api(name: string, body?: unknown) {
  const r = await fetch(
    "/api/bsv/fast/" + name,
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
export function FastBsvApp() {
  const [data, setData] = useState<any>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [checkError, setCheckError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [lastGoodAt, setLastGoodAt] = useState<number | null>(null),
    [goal, setGoal] = useState(
      "Create an ETH/USD market around the next reported price.",
    ),
    [proof, setProof] = useState(false),
    [envelope, setEnvelope] = useState(""),
    [check, setCheck] = useState<any>(null),
    [selectedCase, setSelectedCase] = useState("");
  async function refresh() {
    setRefreshing(true);
    try {
      setData(await api("state"));
      setLoaded(true);
      setLastGoodAt(Date.now());
      setLoadError("");
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setCheck(null);
    setCheckError("");
    setEnvelope("");
    setSelectedCase("");
    setProof(false);
  }, [data.market?.id, data.judgeMarket?.id]);
  async function action(name: string) {
    setBusy(name);
    setError("");
    try {
      await api(name, name === "propose" ? { goal } : {});
      await refresh();
    } catch (e: any) {
      setError(e.message);
      await refresh();
    } finally {
      setBusy("");
    }
  }
  async function judge() {
    setBusy("check");
    setCheckError("");
    setCheck(null);
    try {
      setCheck(
        await api("check", {
          marketId: data.judgeMarket?.id || data.market?.id,
          envelope: JSON.parse(envelope),
        }),
      );
    } catch (e: any) {
      setCheckError(e.message);
    } finally {
      setBusy("");
    }
  }
  const m = data.market,
    p = m?.policy,
    judgeMarket = data.judgeMarket || m,
    funded = !!m?.funding,
    paid = !!m?.payout || ["paid", "refunded"].includes(m?.status),
    buyerStake = Number(p?.buyerStakeSatoshis ?? 1000),
    pool = Number(p?.collateralSatoshis ?? 2000),
    canPropose = loaded && data.canPropose === true,
    nextAction = data.nextAction,
    nextCommand =
      typeof nextAction?.action === "string" &&
      /^[a-z-]+$/.test(nextAction.action)
        ? nextAction.action
        : null,
    captured =
      data.judgeSample ||
      (judgeMarket?.id === m?.id ? m?.finalObservation?.envelope : null),
    reference = judgeMarket?.initialObservation?.envelope,
    judgeCases = Array.isArray(data.judgeCases) ? data.judgeCases : [],
    previousPayments = Array.isArray(data.history)
      ? data.history.filter(
          (entry: any) =>
            entry.payoutTxid && ["paid", "refunded"].includes(entry.status),
        )
      : [],
    disabled = !!busy || !!loadError || !loaded || !!data.executorBusy;
  return (
    <div className="bsv-shell" data-ui="fast-native-market">
      <header className="bsv-top">
        <a className="bsv-brand" href="/">
          VeriFi Market<span>ETH/USD · signed-source settlement</span>
        </a>
        <nav>
          <a href="/next">API3 version</a>
          <details>
            <summary>Earlier versions</summary>
            <a href="/">Original</a>{" · "}
            <a href="/bsv/native">Earlier native attempt</a>{" · "}
            <a href="/bsv">Relay version</a>
          </details>
          <span>BSV testnet</span>
        </nav>
      </header>
      <main className="bsv-main">
        <div className="bsv-title">
          <div>
            <h1>ETH/USD market</h1>
            <p>
              An agent proposes the rule. The contract checks the original API3
              signature and sends the pool to its fixed winner.
            </p>
          </div>
          <button onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {(error || loadError) && (
          <div className="bsv-error" role="alert">
            {error || loadError}
            {loadError && lastGoodAt && (
              <> Last loaded at {time(lastGoodAt / 1000)} Berlin.</>
            )}
          </div>
        )}
        {data.presentation && !data.presentation.nativeReady && (
          <p className="bsv-note" role="status">
            {data.presentation.reason}{" "}
            <a href={data.presentation.recommendedUrl || "/next"}>
              Open the API3 version
            </a>
          </p>
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
                {!loaded
                  ? "Loading…"
                  : m?.status?.replaceAll("_", " ") || "Not prepared"}
              </span>
            </div>
            <label className="bsv-label" htmlFor="fast-goal">
              Agent goal
            </label>
            <textarea
              id="fast-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={500}
              disabled={disabled || !canPropose}
            />
            {canPropose && (
              <div className="bsv-actions">
                <button
                  className="bsv-primary"
                  onClick={() => void action("propose")}
                  disabled={disabled || !goal.trim()}
                >
                  {busy === "propose"
                    ? "Agent choosing…"
                    : m
                      ? "Create the next market"
                      : "Propose market rule"}
                </button>
              </div>
            )}
            <div aria-live="polite">
              {nextAction?.label && <h3>{nextAction.label}</h3>}
              <p className="bsv-note">
                {nextAction?.reason ||
                  (loaded
                    ? "Checking the available next step."
                    : "Loading the current policy and payment state…")}
              </p>
              {data.walletGate?.status &&
                !["ready", "PASS", "verified"].includes(data.walletGate.status) &&
                data.walletGate.reason !== nextAction?.reason && (
                  <p className="bsv-note">{data.walletGate.reason}</p>
                )}
              {nextCommand && nextCommand !== "propose" && (
                <div className="bsv-actions">
                  <button
                    className="bsv-primary"
                    onClick={() => void action(nextCommand)}
                    disabled={disabled}
                  >
                    {busy === nextCommand ? "Working…" : nextAction.label}
                  </button>
                </div>
              )}
            </div>
            <div className="bsv-pool">
              <div>
                <span>Buyer committed</span>
                <strong>
                  {!loaded ? "—" : amount(funded ? buyerStake : 0)} <small>sats</small>
                </strong>
              </div>
              <div className="bsv-pool-rule">⇄</div>
              <div>
                <span>Counterparty committed</span>
                <strong>
                  {!loaded ? "—" : amount(funded ? pool - buyerStake : 0)} <small>sats</small>
                </strong>
              </div>
              <div className="bsv-total">
                <span>Protected pool</span>
                <strong>
                  {!loaded ? "—" : amount(paid ? 0 : funded ? pool : 0)} <small>sats</small>
                </strong>
              </div>
            </div>
            {p ? (
              <>
                <dl className="bsv-rules">
                  <div>
                    <dt>Agent position</dt>
                    <dd>{m.userSide.toUpperCase()} · fixed {amount(buyerStake)} sats</dd>
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
                      {time(p.refundAfter)} Berlin · {amount(buyerStake)} /{" "}
                      {amount(pool - buyerStake)} sats
                      {data.chainTime?.medianTime != null && (
                        <>
                          <br />
                          Chain median: {time(data.chainTime.medianTime)} Berlin
                          {data.chainTime.medianTime > p.refundAfter
                            ? " · lock time passed"
                            : " · waiting for lock time"}
                        </>
                      )}
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
                <p className="bsv-note">
                  The first accepted valid observation within this window sets
                  the result. This is not a quote for one exact second.
                </p>
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
            {m?.status === "node_policy_blocked" && !paid && (
              <p className="bsv-note">
                A public node rejected the saved transaction. No completed
                payment is recorded; its exact transaction remains available
                for reconciliation.
              </p>
            )}
            {m?.funding && (
              <div className="bsv-result">
                <h3>Native contract funded</h3>
                <p>
                  {(m.funding.proof?.status === "MINED" || m.funding.proof?.miningStatus === "MINED")
                    ? "Confirmed in a block."
                    : "Network acceptance recorded; block confirmation is separate."}
                </p>
                <a href={m.funding.explorer} target="_blank" rel="noreferrer">
                  Funding · {short(m.funding.txid)}
                </a>
              </div>
            )}
            {paid && m?.payout && (
              <div className="bsv-result">
                <h3>
                  {m.status === "refunded" ? "Stake refund" : "Outcome payment"}{" "}
                  {(m.payout.proof?.status === "MINED" || m.payout.proof?.miningStatus === "MINED") ? "confirmed" : "accepted"}
                </h3>
                <p>
                  {(m.payout.proof?.status === "MINED" || m.payout.proof?.miningStatus === "MINED")
                    ? "Confirmed in a block."
                    : "Network acceptance recorded. Block confirmation has not been recorded."}
                </p>
                <a href={m.payout.explorer} target="_blank" rel="noreferrer">
                  Payout · {short(m.payout.txid)}
                </a>
              </div>
            )}
            {m?.status === "refund_not_final" && (
              <p className="bsv-note">
                The saved refund is waiting for the chain’s lock time. It has
                not paid yet. Reconciliation uses the same signed transaction
                and does not renew the agent’s spending authority.
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
                <dd>{amount(pool)} native sats</dd>
              </div>
              <div>
                <dt>Oracle charge</dt>
                <dd>0 · Nodary is free</dd>
              </div>
              <div>
                <dt>Funding fee</dt>
                <dd>2,000 test sats · separate fee sponsor</dd>
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
                Test roles are local, not independent customers. Source
                authentication does not prove the upstream fact is true. The
                contract has not had an independent security audit.
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
            <p>{loaded ? "No payment events are recorded for this market." : "Loading payment history…"}</p>
          )}
          {previousPayments.length > 0 && (
            <>
              <h3>Earlier accepted payments</h3>
              <ol>
                {previousPayments.map((entry: any) => (
                  <li key={entry.id}>
                    <span>
                      {entry.status === "refunded"
                        ? "Refund accepted"
                        : "Outcome payment accepted"}{" "}
                      · {short(entry.id)}
                    </span>
                    <a
                      href={"https://test.whatsonchain.com/tx/" + entry.payoutTxid}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {short(entry.payoutTxid)} ↗
                    </a>
                  </li>
                ))}
              </ol>
              <p className="bsv-note">
                These are recorded network payments from earlier markets. Block
                confirmation is shown on each transaction’s explorer page.
              </p>
            </>
          )}
        </section>
        <section className="bsv-trail">
          <h2>Check an original signed response</h2>
          <p>
            This runs the selected immutable policy’s native Script locally.
            It cannot sign, broadcast or move collateral.
          </p>
          {judgeMarket && (
            <p className="bsv-note">
              {judgeMarket.id !== m?.id ? "Checking earlier market " : "Checking market "}
              <code style={{ overflowWrap: "anywhere" }}>{judgeMarket.id}</code>
              {" · "}ETH/USD &gt; ${judgeMarket.thresholdUsd}.
              {judgeMarket.id !== m?.id && " The current pool keeps its own rule and payment state."}
            </p>
          )}
          <label className="bsv-label" htmlFor="fast-recorded-response">
            Recorded response
          </label>
          <select
            id="fast-recorded-response"
            value={selectedCase}
            disabled={!judgeMarket || !judgeCases.length || !!busy}
            onChange={(e) => {
              const index = e.target.value;
              setSelectedCase(index);
              setCheck(null);
              setCheckError("");
              if (index !== "" && judgeCases[Number(index)]) {
                setEnvelope(JSON.stringify(judgeCases[Number(index)].envelope, null, 2));
              }
            }}
            style={{
              width: "100%",
              minWidth: 0,
              minHeight: 44,
              marginBottom: 16,
              padding: "10px 12px",
              font: "inherit",
              color: "inherit",
              background: "#fff",
              border: "1px solid #bec8bc",
              borderRadius: 5,
            }}
          >
            <option value="">
              {judgeCases.length ? "Choose a recorded response" : "No recorded cases available"}
            </option>
            {judgeCases.map((record: any, index: number) => (
              <option value={String(index)} key={record.name}>
                {record.name}
              </option>
            ))}
          </select>
          {selectedCase !== "" && judgeCases[Number(selectedCase)] && (
            <p className="bsv-note">
              Expected local result:{" "}
              {judgeCases[Number(selectedCase)].expectedAccepted ? "accepted" : "rejected"}.
              Use Check response to execute the read-only Script check.
            </p>
          )}
          <label className="bsv-label" htmlFor="fast-envelope">
            Signed response JSON
          </label>
          <textarea
            id="fast-envelope"
            rows={5}
            disabled={!!busy}
            value={envelope}
            onChange={(e) => {
              setEnvelope(e.target.value);
              setSelectedCase("");
              setCheck(null);
              setCheckError("");
            }}
            placeholder='{"timestamp":"…","data":"…","signature":"0x…"}'
          />
          <div className="bsv-actions">
            <button
              onClick={() => {
                setSelectedCase("");
                setCheck(null);
                setCheckError("");
                setEnvelope(JSON.stringify(captured || reference, null, 2));
              }}
              disabled={!judgeMarket || !!busy || !(captured || reference)}
            >
              {captured ? "Load captured response" : "Load initial reference response"}
            </button>
            <button
              onClick={() => void judge()}
              disabled={!judgeMarket || !envelope || !!busy}
            >
              {busy === "check" ? "Executing native Script…" : "Check response"}
            </button>
          </div>
          {!captured && reference && (
            <p className="bsv-note">
              The initial reference predates settlement and may correctly fail
              the observation-window check.
            </p>
          )}
          {checkError && <p className="bsv-error" role="alert">{checkError}</p>}
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
          Rules and recipients are fixed before funding. Earlier versions keep
          their separate transaction history.
        </p>
      </main>
    </div>
  );
}
