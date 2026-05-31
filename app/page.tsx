import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <p className="hero-kicker">NovaDom Realty // choose your lane</p>
        <h1 className="hero-title">One platform, two focused experiences.</h1>
        <p className="hero-text">
          Enter as a broker to manage listings and ask business questions, or continue as a buyer to run semantic
          property search.
        </p>

        <div className="route-grid">
          <Link className="route-link" href="/broker">
            <span className="route-eyebrow">Broker portal</span>
            <h2>Property management</h2>
            <p>Add listings, verify broker ID, and use broker chat for catalogue and inquiry workflows.</p>
            <span className="route-cta">Continue as broker</span>
          </Link>

          <Link className="route-link is-buyer" href="/buyer">
            <span className="route-eyebrow">Buyer portal</span>
            <h2>Property discovery</h2>
            <p>Search in natural language and receive ranked recommendations from the semantic match workflow.</p>
            <span className="route-cta">Continue as buyer</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
