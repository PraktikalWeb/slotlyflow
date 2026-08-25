import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="foundation-page">
      <section className="foundation-content" aria-labelledby="page-title">
        <Image
          className="brand-logo"
          src="/slotlyflow-logo.png"
          alt="SlotlyFlow"
          width={432}
          height={243}
          priority
        />
        <h1 id="page-title">A calmer way to keep customer conversations moving.</h1>
        <p className="intro">
          SlotlyFlow is preparing a secure workspace for WhatsApp automation and human support.
        </p>
        <p className="status" role="status">
          <span aria-hidden="true" /> Application foundation is ready.
        </p>
      </section>
    </main>
  );
}
