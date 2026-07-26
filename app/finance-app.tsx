"use client";

import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CircleUserRound,
  ContactRound,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  Gift,
  Home,
  Landmark,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  ReceiptText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "portofoliu" | "rapoarte" | "plati" | "produse" | "mai-multe";
type AppView = "tabs" | "account";
type TransferKind = "client" | "iban";
type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  type: "in" | "out" | "pending";
};

const CURRENT_ACCOUNT_IBAN = "RO36HOMB0000992005123456789";
const INITIAL_BALANCE = 128_744.16;
const DEMO_STATE_KEY = "home-bank-demo-state-v2";

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "atm-01",
    title: "ATM BUCUREȘTI VICTORIEI",
    subtitle: "Depunere numerar · ATM",
    amount: 4950,
    date: "25 IUL · 18:42",
    type: "in",
  },
  {
    id: "atm-02",
    title: "ATM BUCUREȘTI VICTORIEI",
    subtitle: "Depunere numerar · ATM",
    amount: 4950,
    date: "24 IUL · 17:16",
    type: "in",
  },
  {
    id: "atm-03",
    title: "ATM BUCUREȘTI VICTORIEI",
    subtitle: "Depunere numerar · ATM",
    amount: 4950,
    date: "23 IUL · 19:08",
    type: "in",
  },
  {
    id: "atm-04",
    title: "ATM BUCUREȘTI VICTORIEI",
    subtitle: "Depunere numerar · ATM",
    amount: 4950,
    date: "22 IUL · 16:35",
    type: "in",
  },
  {
    id: "atm-05",
    title: "ATM BUCUREȘTI VICTORIEI",
    subtitle: "Depunere numerar · ATM",
    amount: 4950,
    date: "21 IUL · 18:11",
    type: "in",
  },
  {
    id: "atm-06",
    title: "ATM BUCUREȘTI VICTORIEI",
    subtitle: "Depunere numerar · ATM",
    amount: 4950,
    date: "20 IUL · 15:52",
    type: "in",
  },
];

const TABS: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "portofoliu", label: "Portofoliu", icon: Home },
  { id: "rapoarte", label: "Rapoarte", icon: ReceiptText },
  { id: "plati", label: "Plăți", icon: ArrowLeftRight },
  { id: "produse", label: "Produse", icon: BriefcaseBusiness },
  { id: "mai-multe", label: "Mai multe", icon: MoreHorizontal },
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

function money(value: number) {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidIban(value: string) {
  const normalized = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized)) return false;

  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numeric =
      character >= "A" && character <= "Z"
        ? String(character.charCodeAt(0) - 55)
        : character;
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64ToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

function Brand() {
  return (
    <div className="brand" aria-label="Home Bank">
      <span>HOME</span>
      <b>BANK</b>
    </div>
  );
}

function DesktopBlocked() {
  return (
    <main className="blocked-screen">
      <div className="blocked-card">
        <div className="brand-lock">
          <Smartphone size={28} />
        </div>
        <Brand />
        <p className="eyebrow">APLICAȚIE FINANCIARĂ MOBILĂ</p>
        <h1>Disponibilă exclusiv pe telefon.</h1>
        <p>
          Din motive de securitate, Home Bank nu poate fi utilizată de pe
          desktop. Deschide această adresă pe telefon și instalează aplicația.
        </p>
        <div className="secure-line">
          <ShieldCheck size={19} /> Experiență PWA protejată
        </div>
      </div>
    </main>
  );
}

function InstallScreen({
  onInstall,
  canInstall,
  platform,
}: {
  onInstall: () => void;
  canInstall: boolean;
  platform: "ios" | "android" | "other";
}) {
  const [showHelp, setShowHelp] = useState(!canInstall);

  function requestInstall() {
    if (canInstall) {
      setShowHelp(false);
      onInstall();
      return;
    }
    setShowHelp(true);
  }

  return (
    <main className="install-screen">
      <div className="install-card">
        <div className="app-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" />
        </div>
        <p className="eyebrow">HOME BANK FINANCIAL MVP</p>
        <h1>Finanțele tale, în aplicația mobilă.</h1>
        <p>
          Instalează Home Bank pe ecranul principal pentru acces securizat,
          notificări și autentificare biometrică.
        </p>
        <button className="primary-button install-button" onClick={requestInstall}>
          <Download size={20} /> Instalează aplicația
        </button>
        <p className="install-status" aria-live="polite">
          {canInstall
            ? "Apasă butonul pentru a deschide instalarea securizată."
            : "Browserul tău folosește instalarea din meniul principal."}
        </p>
        {showHelp && (
          <div className="ios-help">
            {platform === "ios" ? (
              <>
                <strong>Instalare pe iPhone sau iPad</strong>
                <ol>
                  <li>Deschide pagina în Safari.</li>
                  <li>Apasă butonul Partajare din bara browserului.</li>
                  <li>Alege „Adăugați la ecranul principal”, apoi „Adăugați”.</li>
                </ol>
              </>
            ) : (
              <>
                <strong>Instalare pe Android</strong>
                <ol>
                  <li>Deschide meniul browserului.</li>
                  <li>Alege „Instalează aplicația” sau „Adaugă pe ecranul principal”.</li>
                  <li>Confirmă instalarea Home Bank.</li>
                </ol>
              </>
            )}
            <div className="browser-menu-hint">
              <ExternalLink size={17} />
              Dacă opțiunea nu apare imediat, reîncarcă pagina o singură dată.
            </div>
          </div>
        )}
        <div className="secure-line">
          <LockKeyhole size={18} /> Aplicația se deschide doar în mod instalat
        </div>
      </div>
    </main>
  );
}

function Login({
  onSuccess,
  supabase,
}: {
  onSuccess: (name: string) => void;
  supabase: SupabaseClient | null;
}) {
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function passwordLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!supabase) {
        if (identity.trim() && password.length >= 6) {
          localStorage.setItem("black-finance-demo-session", "active");
          onSuccess("Constantin Cătălin");
          return;
        }
        throw new Error("Completează utilizatorul și o parolă de minimum 6 caractere.");
      }

      let email = identity.trim();
      if (!email.includes("@")) {
        const response = await fetch("/api/auth/resolve-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email }),
        });
        const payload = (await response.json()) as { email?: string };
        if (!payload.email) throw new Error("Datele de autentificare nu sunt valide.");
        email = payload.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) throw new Error("Datele de autentificare nu sunt valide.");

      const { data: profile } = await supabase
        .from("finance_profiles")
        .select("full_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      onSuccess(profile?.full_name || data.user.user_metadata?.full_name || "Client Home Bank");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Autentificarea a eșuat.");
    } finally {
      setBusy(false);
    }
  }

  async function biometricLogin() {
    setMessage("");
    try {
      const credentialId = localStorage.getItem("black-finance-passkey-id");
      if (!credentialId || !window.PublicKeyCredential) {
        throw new Error(
          "Autentifică-te o dată cu parola și activează amprenta din Securitate și login.",
        );
      }
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [
            {
              id: base64ToBytes(credentialId),
              type: "public-key",
              transports: ["internal"],
            },
          ],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      if (!assertion) throw new Error("Verificarea biometrică a fost anulată.");
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: localStorage.getItem("black-finance-demo-session") } };
      if (!data.session) {
        throw new Error("Sesiunea a expirat. Autentifică-te din nou cu parola.");
      }
      onSuccess("Constantin Cătălin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Amprenta nu a putut fi verificată.");
    }
  }

  return (
    <main className="login-screen">
      <div className="login-top">
        <Brand />
        <div className="login-emblem">
          <Fingerprint size={33} />
        </div>
      </div>
      <section className="login-card">
        <p className="eyebrow">ACCES SECURIZAT</p>
        <h1>Bine ai venit.</h1>
        <p>Accesează portofoliul financiar Home Bank.</p>
        <form onSubmit={passwordLogin}>
          <label>
            Utilizator sau e-mail
            <div className="input-wrap">
              <UserRound size={19} />
              <input
                autoComplete="username"
                value={identity}
                onChange={(event) => setIdentity(event.target.value)}
                placeholder="constantin"
              />
            </div>
          </label>
          <label>
            Parolă
            <div className="input-wrap">
              <LockKeyhole size={19} />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Parola ta"
              />
            </div>
          </label>
          {message && <div className="form-message">{message}</div>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Se verifică…" : "Autentificare"}
            <ArrowRight size={19} />
          </button>
        </form>
        <button className="biometric-button" onClick={biometricLogin}>
          <Fingerprint size={26} />
          Intră cu amprenta
        </button>
        <p className="demo-hint">
          Demo fără Supabase: introdu orice utilizator și o parolă de minimum 6
          caractere.
        </p>
      </section>
    </main>
  );
}

function Header({
  title,
  subtitle,
  onLogout,
}: {
  title?: string;
  subtitle?: string;
  onLogout: () => void;
}) {
  return (
    <header className="app-header">
      {title ? (
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      ) : (
        <Brand />
      )}
      <div className="header-actions">
        <button aria-label="Notificări">
          <Bell size={22} />
          <span className="notification-dot" />
        </button>
        <button aria-label="Profil" onClick={onLogout}>
          <CircleUserRound size={23} />
        </button>
      </div>
    </header>
  );
}

function HomeScreen({
  balance,
  name,
  transactions,
  onNavigate,
  onOpenAccount,
  onLogout,
}: {
  balance: number;
  name: string;
  transactions: Transaction[];
  onNavigate: (tab: Tab) => void;
  onOpenAccount: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <Header onLogout={onLogout} />
      <div className="welcome">
        Salut, {name} <span>👋</span>
      </div>

      <section className="section">
        <div className="section-title">
          <span>CONTURI</span>
          <button>Vezi toate</button>
        </div>
        <button className="account-card account-card-button" onClick={onOpenAccount}>
          <div className="account-row">
            <div className="flag">🇷🇴</div>
            <div>
              <strong>Cont Curent</strong>
              <small>{CURRENT_ACCOUNT_IBAN}</small>
            </div>
            <ChevronRight size={20} />
          </div>
          <div className="balance">{money(balance)} RON</div>
          <div className="carousel-dots">
            <i className="active" />
            <i />
            <i />
          </div>
        </button>
      </section>

      <article className="promo-card">
        <div className="promo-visual">
          <Gift size={35} />
        </div>
        <div>
          <strong>Ce vei face cu 200 de lei în plus?</strong>
          <p>Pune-i la treabă, recomandă și răsplătește prietenii.</p>
        </div>
        <X size={17} />
      </article>

      <section className="section">
        <div className="section-title">
          <span>ULTIMELE MIȘCĂRI</span>
          <button onClick={() => onNavigate("rapoarte")}>Vezi toate</button>
        </div>
        <div className="mini-transactions">
          {transactions.slice(0, 2).map((item) => (
            <div className="mini-transaction" key={item.id}>
              <div className={item.type === "in" ? "round-icon green" : "round-icon orange"}>
                {item.type === "in" ? <ArrowDownLeft size={19} /> : <CreditCard size={19} />}
              </div>
              <div>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </div>
              <b className={item.amount > 0 ? "positive" : ""}>
                {item.amount > 0 ? "+" : ""}
                {money(item.amount)} RON
              </b>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <span>ECONOMII</span>
          <button>Vezi toate</button>
        </div>
        <button className="saving-card">
          <div>
            <strong>Cum deschizi un cont de economii simplu și rapid</strong>
            <p>Obiective inteligente, contribuții automate.</p>
          </div>
          <div className="saving-visual">
            <TrendingUp size={31} />
          </div>
          <ChevronRight size={20} />
        </button>
      </section>
    </>
  );
}

function AccountDetailScreen({
  balance,
  transactions,
  onBack,
  onTransfer,
  onLogout,
}: {
  balance: number;
  transactions: Transaction[];
  onBack: () => void;
  onTransfer: () => void;
  onLogout: () => void;
}) {
  const deposits = transactions.filter(
    (transaction) =>
      transaction.type === "in" &&
      transaction.title === "ATM BUCUREȘTI VICTORIEI",
  );

  return (
    <>
      <div className="detail-header">
        <button className="back-button" onClick={onBack} aria-label="Înapoi">
          <ArrowLeft size={23} />
        </button>
        <Header title="Cont Curent" subtitle="Disponibil în RON" onLogout={onLogout} />
      </div>

      <section className="account-hero">
        <div className="account-hero-top">
          <div className="flag large">🇷🇴</div>
          <span>Cont activ</span>
        </div>
        <p>Sold disponibil</p>
        <strong>{money(balance)} RON</strong>
        <div className="account-iban">
          <small>IBAN</small>
          <b>{CURRENT_ACCOUNT_IBAN}</b>
        </div>
        <button className="primary-button account-transfer-button" onClick={onTransfer}>
          <Send size={19} /> Transfer nou
        </button>
      </section>

      <section className="section account-history">
        <div className="section-title">
          <span>DEPUNERI RECENTE</span>
          <small>{deposits.length} operațiuni</small>
        </div>
        <div className="deposit-list">
          {deposits.map((transaction) => (
            <article className="deposit-row" key={transaction.id}>
              <div className="round-icon green">
                <Banknote size={20} />
              </div>
              <div>
                <strong>{transaction.title}</strong>
                <small>{transaction.subtitle}</small>
                <time>{transaction.date}</time>
              </div>
              <b>+{money(transaction.amount)} RON</b>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function ReportsScreen({
  transactions,
  balance,
  onOpenAccount,
  onLogout,
}: {
  transactions: Transaction[];
  balance: number;
  onOpenAccount: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <Header title="Rapoarte statistici" onLogout={onLogout} />
      <div className="filter-row">
        <button>
          <CalendarDays size={17} /> Ultimele 3 luni <ChevronRight size={15} />
        </button>
        <button>
          Toate valorile <Settings size={16} />
        </button>
      </div>
      <button className="report-account report-account-button" onClick={onOpenAccount}>
        <div className="flag">🇷🇴</div>
        <div>
          <strong>Cont Curent</strong>
          <small>{CURRENT_ACCOUNT_IBAN}</small>
        </div>
        <b>{money(balance)} RON</b>
        <ChevronRight size={18} />
      </button>
      <div className="transaction-list">
        {transactions.map((item) => (
          <article className="transaction" key={item.id}>
            <small className="date">{item.date}</small>
            <div className="transaction-main">
              <div>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </div>
              <b
                className={
                  item.type === "in"
                    ? "positive"
                    : item.type === "pending"
                      ? "pending"
                      : ""
                }
              >
                {item.amount > 0 ? "+" : ""}
                {money(item.amount)} RON
              </b>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function PaymentsScreen({
  onOpenTransfer,
  onLogout,
}: {
  onOpenTransfer: (kind: TransferKind) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <Header title="Plăți" onLogout={onLogout} />
      <div className="search-box">
        <Search size={18} />
        <input placeholder="Caută în plățile tale" />
      </div>
      <div className="payment-actions">
        <button>
          <span className="action-circle blue">
            <FileText />
          </span>
          Facturi
        </button>
        <button onClick={() => onOpenTransfer("iban")}>
          <span className="action-circle orange">
            <Send />
          </span>
          Către IBAN
        </button>
        <button onClick={() => onOpenTransfer("client")}>
          <span className="action-circle purple">
            <ArrowLeftRight />
          </span>
          Între conturi
        </button>
      </div>

      <section className="section">
        <div className="section-title muted">
          <span>PLĂȚI FRECVENTE</span>
        </div>
        <div className="frequent-list">
          <button onClick={() => onOpenTransfer("client")}>
            <span className="avatar">DC</span>
            <span>
              <strong>Dascălu Constantin Cătălin</strong>
              <small>Client Home Bank · transfer instant</small>
            </span>
            <ChevronRight />
          </button>
          <button>
            <span className="round-icon lime">
              <ContactRound />
            </span>
            <span>
              <strong>Contact Home Bank</strong>
              <small>Contact rapid</small>
            </span>
            <ChevronRight />
          </button>
          <button>
            <span className="round-icon orange">
              <Send />
            </span>
            <span>
              <strong>Home Bank Go</strong>
              <small>Plăți și beneficii</small>
            </span>
            <ChevronRight />
          </button>
        </div>
      </section>
    </>
  );
}

function ProductsScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <Header title="Produse" onLogout={onLogout} />
      <div className="quick-access">
        <span>
          <Sparkles size={20} /> Acces rapid
        </span>
        <button>Vezi toate (12)</button>
      </div>
      <article className="refer-card">
        <div className="refer-art">
          <div className="gift-grid">
            {["H", "B", "★", "RON", "GO", "+", "↗", "€", "HB"].map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </div>
        <div className="refer-copy">
          <strong>Recomandă Home Bank prietenilor</strong>
          <p>Tu câștigi 200 de lei, ei se bucură de oferte.</p>
        </div>
        <div className="carousel-dots">
          <i className="active" />
          <i />
          <i />
          <i />
        </div>
      </article>

      <div className="quick-access investment-title">
        <span>
          <TrendingUp size={20} /> Economii și investiții
        </span>
        <button>Vezi toate (6)</button>
      </div>
      <div className="product-grid">
        <article>
          <div className="product-art blue-art">
            <TrendingUp />
          </div>
          <strong>Cont de economii</strong>
          <p>Pune banii la lucru în ritmul tău.</p>
        </article>
        <article>
          <div className="product-art dark-art">
            <Landmark />
          </div>
          <strong>Depozit la termen</strong>
          <p>Obiective clare, randament previzibil.</p>
        </article>
      </div>
    </>
  );
}

function MoreScreen({
  onLogout,
  onEnableBiometric,
  biometricMessage,
}: {
  onLogout: () => void;
  onEnableBiometric: () => void;
  biometricMessage: string;
}) {
  const tiles = [
    { icon: ContactRound, title: "Contact Home Bank", subtitle: "" },
    { icon: UserRound, title: "Datele mele", subtitle: "" },
    { icon: Send, title: "Home Bank Go", subtitle: "Plăți și beneficii" },
    { icon: LockKeyhole, title: "Securitate și login", subtitle: "" },
  ];
  return (
    <>
      <Header title="Mai multe" onLogout={onLogout} />
      <div className="more-grid">
        {tiles.map(({ icon: Icon, title, subtitle }) => (
          <button key={title} onClick={title === "Securitate și login" ? onEnableBiometric : undefined}>
            <span className="tile-icon">
              <Icon />
            </span>
            <strong>{title}</strong>
            {subtitle && <small>{subtitle}</small>}
          </button>
        ))}
      </div>
      {biometricMessage && <div className="success-message">{biometricMessage}</div>}
      <div className="settings-list">
        <button>
          <Settings /> <span>Setări produse și servicii</span> <ChevronRight />
        </button>
        <button>
          <Bell /> <span>Notificări și preferințe comunicare</span> <ChevronRight />
        </button>
        <button>
          <FileText /> <span>Documente</span> <ChevronRight />
        </button>
        <button onClick={onLogout}>
          <LogOut /> <span>Deconectare</span> <ChevronRight />
        </button>
      </div>
      <div className="legal-note">
        Home Bank MVP · Serviciile bancare reale nu sunt încă active.
      </div>
    </>
  );
}

function TransferSheet({
  kind,
  balance,
  onClose,
  onComplete,
  supabase,
}: {
  kind: TransferKind;
  balance: number;
  onClose: () => void;
  onComplete: (transaction: Transaction, amount: number) => void;
  supabase: SupabaseClient | null;
}) {
  const [step, setStep] = useState<"form" | "pending">("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submittedAmount, setSubmittedAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Introdu o sumă validă.");
      return;
    }
    if (numericAmount > balance) {
      setMessage("Sold disponibil insuficient.");
      return;
    }
    if (kind === "iban" && !isValidIban(recipient)) {
      setMessage("Introdu un IBAN internațional valid.");
      return;
    }
    if (kind === "client" && recipient.trim().length < 3) {
      setMessage("Introdu utilizatorul sau e-mailul clientului.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const normalizedRecipient =
        kind === "iban" ? normalizeIban(recipient) : recipient.trim();
      if (supabase) {
        const { error } = await supabase.rpc("finance_create_transfer", {
          p_transfer_type: kind === "client" ? "internal" : "external_iban",
          p_recipient_identifier: kind === "client" ? normalizedRecipient : null,
          p_recipient_iban: kind === "iban" ? normalizedRecipient : null,
          p_amount: numericAmount,
          p_description: description.trim() || "Transfer Home Bank",
          p_idempotency_key: idempotencyKey,
        });
        if (error) throw error;
      }

      onComplete(
        {
          id: idempotencyKey,
          title:
            kind === "client"
              ? `TRANSFER CĂTRE ${recipient.toUpperCase()}`
              : `TRANSFER IBAN ${normalizedRecipient.slice(-6)}`,
          subtitle:
            kind === "client"
              ? "Transfer intern Home Bank"
              : "Transfer extern · în așteptare",
          amount: -numericAmount,
          date: "ASTĂZI",
          type: kind === "client" ? "out" : "pending",
        },
        numericAmount,
      );
      setSubmittedAmount(numericAmount);
      setReference(idempotencyKey.slice(0, 8).toUpperCase());
      setStep("pending");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Transferul nu a putut fi înregistrat.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="transfer-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Transfer nou"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <p className="eyebrow">
              {step === "pending"
                ? "STATUS TRANSFER"
                : kind === "client"
                  ? "TRANSFER INTERN"
                  : "TRANSFER INTERNAȚIONAL"}
            </p>
            <h2>{step === "pending" ? "Confirmare" : "Transfer nou"}</h2>
          </div>
          <button onClick={onClose} aria-label="Închide">
            <X />
          </button>
        </div>
        {step === "form" ? (
          <>
            <div className="available-balance">
              <span>Sold disponibil</span>
              <strong>{money(balance)} RON</strong>
            </div>
            <form onSubmit={submit}>
              <label>
                {kind === "client" ? "Utilizator sau e-mail client" : "IBAN beneficiar"}
                <input
                  autoCapitalize="characters"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder={
                    kind === "client"
                      ? "client@exemplu.com"
                      : "DE89 3704 0044 0532 0130 00"
                  }
                />
              </label>
              <label>
                Sumă
                <div className="amount-field">
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0,00"
                  />
                  <span>RON</span>
                </div>
              </label>
              <label>
                Detalii plată
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex: Factura iulie"
                />
              </label>
              {message && <div className="form-message">{message}</div>}
              <button className="primary-button" disabled={busy}>
                {busy ? "Se procesează…" : "Continuă"}
                <ArrowRight />
              </button>
            </form>
            <p className="transfer-disclaimer">
              Acceptăm IBAN-uri internaționale valide. Transferurile sunt
              înregistrate în MVP și necesită integrarea unui furnizor bancar
              autorizat pentru decontare reală.
            </p>
          </>
        ) : (
          <div className="pending-transfer">
            <div className={kind === "iban" ? "pending-status-icon" : "success-status-icon"}>
              {kind === "iban" ? <Clock3 size={34} /> : <Check size={34} />}
            </div>
            <p className="eyebrow">
              {kind === "iban" ? "TRANSFER ÎN AȘTEPTARE" : "TRANSFER EFECTUAT"}
            </p>
            <h3>{money(submittedAmount)} RON</h3>
            <p className="pending-recipient">
              {kind === "iban" ? normalizeIban(recipient) : recipient}
            </p>
            {kind === "iban" && (
              <div className="international-notice">
                <Clock3 size={21} />
                <div>
                  <strong>Procesare internațională</strong>
                  <p>
                    Transferurile internaționale pot dura între 3 și 5 zile
                    lucrătoare.
                  </p>
                </div>
              </div>
            )}
            <div className="transfer-reference">
              <span>Referință</span>
              <strong>{reference}</strong>
            </div>
            <button className="primary-button" onClick={onClose}>
              Închide <Check size={19} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function MobileApp({
  profileName,
  onLogout,
  supabase,
}: {
  profileName: string;
  onLogout: () => void;
  supabase: SupabaseClient | null;
}) {
  const [tab, setTab] = useState<Tab>("portofoliu");
  const [view, setView] = useState<AppView>("tabs");
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [transfer, setTransfer] = useState<TransferKind | null>(null);
  const [toast, setToast] = useState("");
  const [biometricMessage, setBiometricMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(DEMO_STATE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        balance?: number;
        transactions?: Transaction[];
      };
      if (typeof parsed.balance === "number") {
        // Restores the persistent local MVP ledger after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBalance(parsed.balance);
      }
      if (Array.isArray(parsed.transactions)) {
        setTransactions(parsed.transactions);
      }
    } catch {
      // Ignore a malformed local demo cache.
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: account } = await supabase
        .from("finance_accounts")
        .select("available_balance")
        .eq("owner_id", userData.user.id)
        .eq("currency", "RON")
        .maybeSingle();
      const { data: rows } = await supabase
        .from("finance_transactions")
        .select("id,title,description,amount,direction,status,created_at")
        .eq("owner_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active) return;
      if (account) setBalance(Number(account.available_balance));
      if (rows?.length) {
        setTransactions(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            subtitle: row.description || "Tranzacție",
            amount: Number(row.amount) * (row.direction === "debit" ? -1 : 1),
            date: new Date(row.created_at).toLocaleDateString("ro-RO", {
              day: "2-digit",
              month: "short",
            }),
            type:
              row.status === "pending"
                ? "pending"
                : row.direction === "credit"
                  ? "in"
                  : "out",
          })),
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  function completeTransfer(transaction: Transaction, amount: number) {
    const nextBalance = balance - amount;
    const nextTransactions = [transaction, ...transactions];
    setBalance(nextBalance);
    setTransactions(nextTransactions);
    if (!supabase) {
      localStorage.setItem(
        DEMO_STATE_KEY,
        JSON.stringify({ balance: nextBalance, transactions: nextTransactions }),
      );
    }
    setToast(
      transaction.type === "pending"
        ? "Transferul IBAN a fost înregistrat și așteaptă procesarea."
        : "Transferul intern a fost efectuat.",
    );
    window.setTimeout(() => setToast(""), 3800);
  }

  async function enableBiometric() {
    try {
      if (!window.PublicKeyCredential) throw new Error("Dispozitivul nu acceptă autentificare biometrică.");
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Home Bank" },
          user: {
            id: userId,
            name: "client-home-bank",
            displayName: profileName,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            residentKey: "preferred",
            userVerification: "required",
          },
          timeout: 60_000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Înregistrarea a fost anulată.");
      localStorage.setItem(
        "black-finance-passkey-id",
        bytesToBase64(new Uint8Array(credential.rawId)),
      );
      setBiometricMessage("Amprenta a fost activată pentru acest dispozitiv.");
    } catch (error) {
      setBiometricMessage(
        error instanceof Error ? error.message : "Amprenta nu a putut fi activată.",
      );
    }
  }

  const content = (() => {
    if (view === "account") {
      return (
        <AccountDetailScreen
          balance={balance}
          transactions={transactions}
          onBack={() => setView("tabs")}
          onTransfer={() => setTransfer("iban")}
          onLogout={onLogout}
        />
      );
    }
    if (tab === "rapoarte") {
      return (
        <ReportsScreen
          transactions={transactions}
          balance={balance}
          onOpenAccount={() => setView("account")}
          onLogout={onLogout}
        />
      );
    }
    if (tab === "plati") {
      return <PaymentsScreen onOpenTransfer={setTransfer} onLogout={onLogout} />;
    }
    if (tab === "produse") return <ProductsScreen onLogout={onLogout} />;
    if (tab === "mai-multe") {
      return (
        <MoreScreen
          onLogout={onLogout}
          onEnableBiometric={enableBiometric}
          biometricMessage={biometricMessage}
        />
      );
    }
    return (
      <HomeScreen
        balance={balance}
        name={profileName}
        transactions={transactions}
        onNavigate={setTab}
        onOpenAccount={() => setView("account")}
        onLogout={onLogout}
      />
    );
  })();

  return (
    <main className="app-shell">
      <div className="phone-content">{content}</div>
      <nav className="bottom-nav" aria-label="Navigație principală">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setView("tabs");
              setTab(id);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {transfer && (
        <TransferSheet
          kind={transfer}
          balance={balance}
          onClose={() => setTransfer(null)}
          onComplete={completeTransfer}
          supabase={supabase}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={19} /> {toast}
        </div>
      )}
    </main>
  );
}

export default function FinanceApp() {
  const [ready, setReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [installPlatform, setInstallPlatform] = useState<
    "ios" | "android" | "other"
  >("other");
  const [authenticated, setAuthenticated] = useState(false);
  const [profileName, setProfileName] = useState("Constantin Cătălin");
  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get("preview") === "1";
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const android = /Android/i.test(navigator.userAgent);
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    // Device capabilities are only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(!preview && !mobileUa && !narrow);
    setIsStandalone(standalone || preview);
    setInstallPlatform(ios ? "ios" : android ? "android" : "other");

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const installedHandler = () => {
      setIsStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .catch(() => undefined);
    }

    void (async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setAuthenticated(true);
          const { data: profile } = await supabase
            .from("finance_profiles")
            .select("full_name")
            .eq("user_id", data.session.user.id)
            .maybeSingle();
          if (profile?.full_name) setProfileName(profile.full_name);
        }
      } else if (localStorage.getItem("black-finance-demo-session") === "active") {
        setAuthenticated(true);
      }
      setReady(true);
    })();

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [supabase]);

  async function install() {
    const prompt = installPrompt as Event & {
      prompt?: () => Promise<void>;
      userChoice?: Promise<{ outcome: string }>;
    };
    await prompt.prompt?.();
    await prompt.userChoice;
    setInstallPrompt(null);
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem("black-finance-demo-session");
    setAuthenticated(false);
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="app-mark pulse">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" />
        </div>
        <p>Se securizează aplicația…</p>
      </main>
    );
  }
  if (isDesktop) return <DesktopBlocked />;
  if (!isStandalone) {
    return (
      <InstallScreen
        onInstall={install}
        canInstall={Boolean(installPrompt)}
        platform={installPlatform}
      />
    );
  }
  if (!authenticated) {
    return <Login onSuccess={(name) => { setProfileName(name); setAuthenticated(true); }} supabase={supabase} />;
  }
  return <MobileApp profileName={profileName} onLogout={logout} supabase={supabase} />;
}
