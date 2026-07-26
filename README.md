# Home Bank — Mobile PWA MVP

Un MVP financiar mobile-only în limba română, inspirat de interfața furnizată:

- autentificare cu utilizator/e-mail și parolă prin Supabase Auth;
- deblocare biometrică WebAuthn pe dispozitiv după prima autentificare;
- sold inițial demonstrativ de **128.744,16 RON**;
- transfer intern atomic între doi clienți Home Bank;
- transfer către orice IBAN internațional valid în starea **În așteptare**;
- rezervarea imediată a sumei și scăderea ei din soldul disponibil;
- registru persistent pentru toate transferurile în așteptare;
- portofoliu, rapoarte, plăți, produse și setări;
- PWA instalabilă cu service worker și manifest;
- interfață blocată pe desktop;
- mod demo local când Supabase nu este configurat.

## Compatibilitate cu repository-ul existent

Home Bank folosește Supabase, nu Drizzle ORM. Arhiva include un fișier
`drizzle.config.ts` fără importuri, care suprascrie în siguranță configurația
Drizzle rămasă din versiunile vechi ale repository-ului. Nu instala
`drizzle-kit`; nu este necesar pentru această aplicație.

## Limită importantă

Acesta este un **application ledger MVP**, nu o bancă și nu un procesator de
plăți. Transferul intern mută sold între conturi din baza aplicației. Un transfer
IBAN este doar rezervat și marcat `pending`. Pentru mutarea reală a banilor este
necesară integrarea cu un furnizor autorizat EMI/PI/BaaS, verificări KYC/KYB,
AML, sancțiuni, SCA, reconciliere și control operațional.

## Configurare Supabase

1. Creează un proiect Supabase.
2. Rulează, în ordine, toate fișierele din `supabase/migrations/` în SQL Editor.
   Dacă baza exista deja, rulează cel puțin
   `002_balance_and_international_pending.sql`.
3. În Supabase Auth dezactivează public sign-up dacă accesul va fi doar prin
   invitație.
4. Adaugă în Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` rămâne exclusiv pe server. Nu o prefixa cu
`NEXT_PUBLIC_`.

## Autentificare biometrică

Implementarea inclusă folosește WebAuthn ca verificare locală a dispozitivului
și necesită o sesiune Supabase încă validă. Pentru autentificare passkey completă,
credentialele trebuie înregistrate și verificate criptografic pe server folosind
tabela `finance_passkeys` și un serviciu WebAuthn server-side.

## Dezvoltare și verificare

Interfața completă este accesibilă doar în PWA instalată. Pentru previzualizare
mobilă în dezvoltare se poate folosi parametrul `?preview=1`.

Build Vercel:

```text
npx next build
```

Configurația `vercel.json` folosește builderul Next.js standard.

## Fluxuri incluse

- Portofoliu cu sold și ultimele tranzacții;
- rapoarte și istoric;
- transfer către client după username sau e-mail;
- transfer IBAN internațional în așteptare, cu rezervarea soldului;
- listă persistentă „Transferuri în așteptare”;
- produse demonstrative;
- activare amprentă din `Mai multe → Securitate și login`;
- deconectare.
