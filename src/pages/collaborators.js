import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './collaborators.module.css';

function Breadcrumb() {
  return (
    <nav className={styles.breadcrumb} aria-label="breadcrumbs">
      <Link href="/">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-label="Home">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </Link>
      <span className={styles.breadcrumbSep}>›</span>
      <span>Collaborators</span>
    </nav>
  );
}

function CollaboratorCard({ name, hostedBy, hostedByUrl, description, url, logoUrl }) {
  let visitLabel = 'Visit website';
  try {
    visitLabel = `Visit ${new URL(url).hostname.replace(/^www\./, '')}`;
  } catch (_) {}

  const resolvedLogo = useBaseUrl(logoUrl);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        {logoUrl && <img src={resolvedLogo} alt={name} className={styles.logo} />}
        <div>
          <h3 className={styles.cardTitle}>{name}</h3>
          {hostedBy && (
            <p className={styles.hostedBy}>
              Hosted by{' '}
              <a href={hostedByUrl} target="_blank" rel="noopener noreferrer">
                {hostedBy}
              </a>
            </p>
          )}
        </div>
      </div>
      <p className={styles.cardDescription}>{description}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.visitButton}>
        {visitLabel} ↗
      </a>
    </div>
  );
}

export default function Collaborators() {
  return (
    <Layout
      title="Collaborators"
      description="Organizations collaborating with Multipaz on open digital credentials">
      <main className={styles.main}>
        <Breadcrumb />
        <h1>Collaborators</h1>
        <p className={styles.intro}>
          Multipaz actively participates in leading standards bodies shaping the future of digital
          credentials - contributing to draft specifications, implementing emerging standards,
          taking part in interoperability testing events, and providing feedback to help refine
          the ecosystem.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Partners</h2>
          <div className={styles.cardList}>
            <CollaboratorCard
              name="Open Mobile Hub (OMH)"
              hostedBy="Linux Foundation"
              hostedByUrl="https://linuxfoundation.org"
              description="Open Mobile Hub simplifies native and cross-platform mobile app development by abstracting away the challenges of platform fragmentation across Android, iOS, and more. OMH provides a unified, open source SDK framework that enables on-the-fly service switching within applications, allowing deployment across multiple device ecosystems with a single codebase."
              url="https://openmobilehub.org"
              logoUrl="/img/omh.png"
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Multipaz contributors participate in</h2>
          <div className={styles.cardList}>
            <CollaboratorCard
              name="ISO/IEC JTC1 SC17 Working Group 10"
              description="ISO/IEC JTC1 SC17 WG10 is the international standards working group responsible for specifications covering motor vehicle driver licences and related identity credentials. It develops and maintains the ISO 18013 series — including ISO 18013-5 and 18013-7, which define how mobile driving licences (mDLs) are issued, stored, and presented securely across devices and platforms. WG10 and its members actively engage with a broad set of stakeholders to ensure that identity verification technologies meet rigorous international standards for interoperability and security."
              url="https://github.com/ISOWG10/ISO-18013"
              logoUrl="/img/iso_jtc1_iec.png"
            />
            <CollaboratorCard
              name="OpenID Foundation: DCP Working Group"
              description="The Digital Credentials Protocols (DCP) Working Group develops OpenID specifications for issuing and presenting digital credentials across any format — including W3C Verifiable Credentials, IETF SD-JWT VCs, and ISO/IEC 18013-5 mDLs - within an Issuer-Holder-Verifier model. Its goal is to give end-users greater control, privacy, and portability over their identity information while supporting pseudonymous authentication. Key specifications produced by the group include OID4VCI (credential issuance), and OID4VP (credential presentation)."
              url="https://openid.net/wg/digital-credentials-protocols/"
              logoUrl="/img/openid.png"
            />
          </div>
        </section>

        <div className={styles.cta}>
          <strong>Interested in collaborating with Multipaz?</strong>
          <p>
            We welcome organizations working on digital identity, mobile development, and open
            standards. Reach out via our{' '}
            <a href="/contributing/contributing">Contributing guide</a> or open a discussion on{' '}
            <a
              href="https://github.com/openwallet-foundation/mdoc-lib/discussions"
              target="_blank"
              rel="noopener noreferrer">
              GitHub
            </a>
            .
          </p>
        </div>
      </main>
    </Layout>
  );
}
