import { useEffect, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { PublicFooter } from '../components/PublicNav'
import { legalDocument, legalReady, siteDetails } from '../legal/siteDetails'
import '../legal/legal.css'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="legal-section"><h2>{title}</h2>{children}</section>
}

function ContactLink() {
  return <a href="/contact">contact IZZY support</a>
}

function Operator() {
  return siteDetails.operatorName && siteDetails.operatorCountry
    ? <><p>IZZY Prompter is operated by {siteDetails.operatorName}, based in {siteDetails.operatorCountry}. For service, payment or privacy requests, <ContactLink />.</p>{siteDetails.operatorAddress && <address className="legal-address">{siteDetails.operatorAddress}</address>}</>
    : <p>The operator’s public identity and country are awaiting confirmation before these documents are published.</p>
}

function Terms() {
  return <>
    <Section title="The service"><p>IZZY Prompter is a browser-based teleprompter. You can prepare a script, read it on a display and control a hosted take from a paired phone. Guest prompting is available without an account.</p><Operator /></Section>
    <Section title="Your account and scripts"><p>An account lets you save scripts and use them across devices. IZZY uses email sign-in links instead of passwords. Keep access to your email and sign-in links private, and only share pairing links with people you want to join your take.</p><p>You keep your rights to the scripts you provide. You are responsible for having permission to use that content. IZZY processes it to save, display and synchronize your scripts and takes, as described in the <a href="/privacy">Privacy Policy</a>.</p></Section>
    <Section title="Free and Pro"><p>Free accounts can keep three active saved scripts. Prepared standalone offline prompting and the Original remote finish are free.</p><p>Izzy Pro adds unlimited saved-script count, named display presets and fifteen additional remote finishes. Individual script sizes, storage and technical limits still apply. See <a href="/pro">Izzy Pro</a> for the current offer and availability.</p></Section>
    <Section title="One payment. Lifetime access."><p>Pro is a one-time purchase, with no recurring subscription or renewal charge. The purchase price and currency are shown before you pay.</p><p>“Lifetime access” means continued access to the purchased Izzy Pro features for as long as the IZZY Prompter service is actively operated. It is not a promise that the service will operate forever.</p><p>Pro includes updates and improvements to that product during its operation. Separate future products or services may be offered independently. Changes to future offers do not create recurring charges for an existing purchase.</p></Section>
    <Section title="Payment and delivery"><p>When sales are available, a signed-in buyer starts checkout on IZZY and pays on Lava.top. We activate Pro on the purchasing IZZY account after the server verifies the payment. A return URL alone does not confirm payment. Activation can take longer if the provider’s confirmation is delayed.</p><p>If you were charged and access is missing, check purchase status in <a href="/account">your account</a> or <ContactLink />. The <a href="/refunds">Refund Policy</a> explains how to request help or a refund.</p></Section>
    <Section title="Use with care"><p>Do not use IZZY unlawfully, commit payment fraud, attempt unauthorized access, interfere with another user’s content or disrupt the service. We may restrict abusive use where necessary to protect the service and its users.</p></Section>
    <Section title="Availability and offline use"><p>Hosted pairing, sign-in, account synchronization and payment confirmation need a connection to our servers. Maintenance, network problems and technical failures may interrupt these features. Server restarts end active hosted takes; saved account scripts are separate from live session state.</p><p>Standalone offline use requires preparing the browser and script in advance. Browser storage can be cleared or become unavailable, so keep a text backup of important scripts. Direct offline phone pairing is experimental and depends on a reachable local network and device support.</p></Section>
    <Section title="Changes and your rights"><p>We may update the service and these terms. The updated date identifies the current version. Material changes to purchased access will be communicated through the service or your account contact where appropriate. Nothing here removes rights or remedies you have under applicable law.</p><p>For questions about these terms, <ContactLink />.</p></Section>
  </>
}

function Privacy() {
  return <>
    <Section title="Who handles your data"><Operator /><p>This policy describes IZZY’s guest, account and prepared offline workflows. Payment processing takes place on Lava.top when you choose to start an available checkout.</p></Section>
    <Section title="Scripts on this device"><p>The browser can store guest drafts, prompt settings, reading positions and quick-edit recovery data. Prepared offline scripts and pending account edits use browser storage, including IndexedDB. We also keep local preferences such as your remote finish and connection mode.</p><p>These local copies are not a separate cloud backup. Clearing browser data, private browsing restrictions or losing the device can remove them. Other people using the same browser profile may be able to access local data. Export important scripts before clearing storage.</p></Section>
    <Section title="Hosted takes and paired devices"><p>Starting a hosted take sends your script to IZZY’s server and to the devices you authorize with pairing links. Guest hosted text is held in live server memory; it does not stay exclusively in your browser. Live sessions expire after inactivity and end when the application restarts. Activity can extend a session.</p><p>Pairing credentials let devices access a take. Keep these links private. Account-linked script edits can also be saved back to your account library.</p></Section>
    <Section title="Accounts and saved content"><p>For account features, we store your email address, account identifier, sign-in identity, saved scripts, presets and the records needed to synchronize changes. Your account library is stored in PostgreSQL on our server.</p><p>We use this data to deliver sign-in links, maintain your library, resolve edit conflicts and manage account access. Pending changes may remain on your device until they are synchronized or removed.</p></Section>
    <Section title="Sign-in and essential storage"><p>Email sign-in links are single-use and expire after 15 minutes. Account session tokens are hashed in the database. The browser uses an essential HttpOnly account-session cookie, marked Secure on HTTPS and SameSite=Lax. Sessions last up to 30 days unless ended earlier, including by logout.</p><p>Browser session storage can hold an account identity hint and a short-lived purchase-return destination. These hints do not authorize account access or confirm a purchase. Google sign-in is used only if it is offered and you choose it; the integration stores the linked Google identity rather than your Google password.</p></Section>
    <Section title="Payments"><p>If you start checkout, IZZY sends your account email, product offer, amount, currency and return destinations to Lava.top. Lava.top and its payment providers handle the payment form. IZZY does not receive or store your full payment card details.</p><p>We retain normalized purchase and provider references, amount and currency, payment state, timestamps, Pro grants and support/audit records. These are needed to deliver access, verify payments, handle refunds and disputes, and reconcile records. Read <a href="https://lava.top/en/docs/policy" target="_blank" rel="noreferrer">Lava.top’s privacy policy</a> for its processing.</p></Section>
    <Section title="Why we process this information"><p>We process account, script and purchase information to provide the service you request and perform our agreement with you. We process necessary security and operational information for our legitimate interests in protecting IZZY, preventing abuse and keeping the service reliable. Some transaction records may also need to be retained to meet legal obligations.</p><p>Where the GDPR applies, these purposes rely respectively on Article 6(1)(b), Article 6(1)(f) and Article 6(1)(c). Providing an account email is necessary for email sign-in; you can choose guest use instead. A purchase requires the information needed by the payment provider.</p></Section>
    <Section title="Infrastructure and diagnostics"><p>Our documented service infrastructure uses netcup hosting and Yandex Cloud Postbox for transactional email. These providers process information needed to host IZZY and deliver sign-in messages. Lava.top receives checkout information when payment is requested.</p><p>Network and connection information, including IP addresses, is processed to deliver requests, apply rate limits and protect the service. Operational logs help investigate errors. Application diagnostics use aggregate counters; script content and pairing credentials are excluded from those counters, and request parameters are filtered.</p><p>The current product measurement adapter dispatches events within your browser and has no external analytics collector. We do not use that adapter to send your scripts or raw pairing URLs to an advertising service.</p></Section>
    <Section title="Retention and backups"><p>Saved scripts remain in the account library until removed. Trashed scripts and edit-mutation receipts become eligible for cleanup after 30 days; expired account tokens are also cleaned up. Cleanup runs in bounded batches, so these are not promises of deletion at an exact instant.</p><p>Active account and commerce records are not removed by that routine. We retain payment and audit records as needed to manage purchased access, resolve disputes and meet applicable obligations. Backups follow separate retention and rotation procedures; deleting live data does not immediately erase every backup copy.</p></Section>
    <Section title="Your choices and requests"><p>You can use guest prompting without creating an account, export scripts, clear local browser data, trash account scripts and log out. Account deletion and privacy requests are handled through <a href="/contact">support</a>; there is currently no self-service account-deletion control.</p><p>Where applicable, you can request access to or a copy of your data, correction, deletion, restriction of processing and data portability. You can object to processing based on legitimate interests and withdraw consent where processing relies on it, without affecting earlier lawful processing. You can also lodge a complaint with a data protection supervisory authority, including in the place where you live or work.</p><p>To make a request, <ContactLink /> from the email associated with your account where possible. We may need to verify ownership and retain some records for purchased access, disputes or legal obligations. Do not send payment card details, sign-in links or pairing credentials.</p></Section>
    <Section title="Updates"><p>We will update this policy when the service’s data practices change. The updated date identifies this version. For questions, <ContactLink />.</p></Section>
  </>
}

function Refunds() {
  return <>
    <Section title="Help with your purchase"><p>Izzy Pro is a digital product purchased once. Access is activated on your IZZY account after payment is verified. If something went wrong, we review the circumstances of your request and the rights that apply to your purchase.</p><p>This policy does not limit mandatory consumer rights or remedies under applicable law.</p></Section>
    <Section title="When to contact us"><ul><li>You were charged but Pro was not delivered to the purchasing account.</li><li>You paid twice for the same access.</li><li>A serious technical problem prevents reasonable use of the purchased features.</li><li>You have another refund request covered by applicable law or the payment provider’s procedures.</li></ul><p>For a delayed confirmation, first check the purchase status in <a href="/account">your account</a>. Do not start another payment while the earlier charge is unresolved.</p></Section>
    <Section title="How to request a refund"><p><ContactLink /> with your purchase email, approximate purchase date, IZZY order reference if available, and a description of the issue. Order references appear in your account’s purchase status.</p><p>We may ask for additional information to identify the transaction and understand the problem. Never send full card details, sign-in links or remote pairing credentials.</p></Section>
    <Section title="Processing a request"><p>Payments and refunds are handled through Lava.top and the relevant payment providers. Requests are subject to applicable rights and provider procedures; bank processing times and available payment routes may vary. We cannot promise an immediate bank credit.</p><p>Some payment events require manual transaction verification before the corresponding IZZY purchase can be updated. Keep your order reference so we can investigate the right purchase. See <a href="https://lava.top/docs/terms" target="_blank" rel="noreferrer">Lava.top’s terms and refund procedure</a>.</p></Section>
    <Section title="What happens to Pro"><p>A completed full refund removes the Pro grant associated with that purchase. A partial refund retains that grant. Another independent valid Pro grant keeps Pro active. A payment dispute can suspend access from the disputed purchase while it is reviewed.</p><p>Refunds do not delete your account, scripts or saved presets. Free account limits apply when no active Pro grant remains.</p></Section>
  </>
}

function Contact() {
  return <>
    <Section title="IZZY Prompter support"><p>For account, payment, technical or privacy requests, use the support address below.</p>
      {siteDetails.supportEmail ? <p className="legal-contact-email"><a href={`mailto:${siteDetails.supportEmail}`}>{siteDetails.supportEmail}<ArrowUpRight size={20} aria-hidden="true" /></a></p>
        : <p>A receiving support address is awaiting confirmation before publication. The account sign-in sender is not a support inbox.</p>}
    </Section>
    <Section title="Help us find the issue"><p>For account issues, write from your account email if possible. For payments, include the approximate purchase date and IZZY order reference from <a href="/account">your account</a>. For a technical problem, include your device, browser and a short description of what happened.</p><p>Do not include full card details, sign-in links, pairing credentials or confidential script text.</p></Section>
    <Section title="Service operator"><Operator /><p><a href="https://izzyprompter.com">izzyprompter.com</a></p></Section>
  </>
}

const documents = { '/terms': Terms, '/privacy': Privacy, '/refunds': Refunds, '/contact': Contact }

export function LegalPage() {
  const document = legalDocument(window.location.pathname)!
  const Content = documents[document.href]
  useEffect(() => { window.document.title = `${document.title} — IZZY Prompter` }, [document.title])
  return <main className="product-page legal-page">
    <header className="legal-header"><a href="/" aria-label="IZZY home"><BrandLogo /></a><a href="/pro">Izzy Pro <ArrowUpRight size={16} /></a></header>
    <article className="legal-article"><a className="legal-back" href="/"><ArrowLeft size={16} />Back to IZZY</a>
      <h1>{document.title}</h1><p className="legal-date">{legalReady ? 'Last updated' : 'Draft updated'} <time dateTime={siteDetails.updatedDate}>{new Date(`${siteDetails.updatedDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></p>
      {!legalReady && <aside className="legal-draft" aria-label="Draft status">Draft for review. The policy wording is awaiting final approval before publication.</aside>}
      <Content />
    </article><PublicFooter />
  </main>
}
