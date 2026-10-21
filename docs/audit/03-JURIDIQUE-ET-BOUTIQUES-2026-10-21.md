# Revérification juridique et conformité boutiques — Le Petit Tou

- **Date** : 21 octobre 2026. **Dépôt** : `le-petit-tou`, `HEAD` = `65fbd81` (+ `app.json` modifié : `allowBackup: false`).
- **Périmètre** : section D (juridique) et volets boutiques du rapport du 19/10 (`01-RAPPORT-AUDIT-2026-10-19.md`), de `02-PUBLICATION.md` et de leur suite (`04-SUIVI-2026-10-21.md`).
- **Nature du document** : analyse technique et documentaire, **pas un avis juridique**. Aucune ligne n'est « conforme » au sens d'une validation par un juriste ou un DPO ; « conforme » signifie seulement « l'état du dépôt correspond à la règle telle que je l'ai lue aujourd'hui ».
- **Aucun fichier de code n'a été modifié.** Ce rapport est le seul fichier créé.
- **Production** : je n'ai exécuté aucun test contre Supabase aujourd'hui. L'état de production (006 et 007 déployés, tâches `lpt-push-tick` et `lpt-purge` actives) est repris de `04-SUIVI-2026-10-21.md` §1 et n'est pas revérifié ici.

Légende des statuts : **conforme** / **non conforme** / **incomplet** / **non applicable** / **impossible à vérifier**. « À valider » accompagne une conclusion d'applicabilité qui demande un juriste.
Légende de la nature de la règle : **[L]** obligation légale, **[R]** recommandation d'autorité, **[BP]** bonne pratique, **[P]** règle de plateforme (Apple/Google).

---

## 0. Sources consultées et ce qui a réellement pu être lu

Je distingue ce que j'ai **lu aujourd'hui** de ce que je n'ai pas pu lire. Les identifiants `S..` sont repris dans les fiches.

### 0.1 Lues aujourd'hui (texte ou résumé de la page obtenu)

| Id | Source | URL | Remarque |
|---|---|---|---|
| S1 | EDPB, Lignes directrices 2/2023 (art. 5(3) ePrivacy), v2.0 du 7/10/2024 | https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf | PDF lu en local (15 pages extraites) |
| S2 | CNIL, Recommandation relative aux applications mobiles (version FR, PDF 98 p., fichier daté 2024-09) | https://www.cnil.fr/sites/cnil/files/2024-09/recommandation-applications-mobiles.pdf | PDF lu en local. Le numéro de délibération n'apparaît pas dans le texte extrait : je ne le cite pas |
| S3 | CNIL, même recommandation, version EN (PDF 93 p., 2025-05) | https://www.cnil.fr/sites/cnil/files/2025-05/recommendation-mobiles-app.pdf | téléchargée, non relue en détail (la FR fait foi pour mes citations) |
| S4 | RGPD art. 30 (miroir **non officiel**) | https://gdpr-info.eu/art-30-gdpr/ | utilisé faute d'accès à EUR-Lex |
| S5 | RGPD art. 4 (miroir non officiel) | https://gdpr-info.eu/art-4-gdpr/ | idem |
| S6 | RGPD art. 8 (miroir non officiel) | https://gdpr-info.eu/art-8-gdpr/ | idem |
| S7 | RGPD art. 11 (miroir non officiel) | https://gdpr-info.eu/art-11-gdpr/ | idem |
| S8 | RGPD considérant 26 (miroir non officiel) | https://gdpr-info.eu/recitals/no-26/ | idem |
| S9 | Supabase, Data Processing Addendum (« Version 1, 1er août 2026 ») | https://supabase.com/legal/dpa | résumé obtenu |
| S10 | Expo, politique de confidentialité (mise à jour 21/10/2025) | https://expo.dev/privacy | résumé obtenu |
| S11 | Expo, doc SecureStore | https://docs.expo.dev/versions/latest/sdk/securestore/ | persistance Keychain / sauvegarde Android |
| S12 | Expo, doc Notifications | https://docs.expo.dev/versions/latest/sdk/notifications/ | lue à ~80 % (100 000 / 123 389 caractères) |
| S13 | Expo, envoi de notifications (tickets, reçus, sécurité) | https://docs.expo.dev/push-notifications/sending-notifications/ | résumé obtenu |
| S14 | Expo, manifestes de confidentialité Apple | https://docs.expo.dev/guides/apple-privacy/ | résumé obtenu |
| S15 | Apple, App Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ | lues à ~87 % (100 000 / 114 428 caractères) ; la page n'affiche pas de date de mise à jour |
| S16 | Apple, suppression de compte | https://developer.apple.com/support/offering-account-deletion-in-your-app/ | lue |
| S17 | Apple, exigences à venir (dates) | https://developer.apple.com/news/upcoming-requirements/ | lue (dernière entrée : 9/09/2026) |
| S18 | Apple, App Privacy Details | https://developer.apple.com/app-store/app-privacy-details/ | lue |
| S19 | Apple, classes d'âge | https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/ | lue à ~86 % |
| S20 | Apple, statut de « trader » (DSA) | https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements | lue |
| S21 | Google Play, tests requis pour les nouveaux comptes personnels | https://support.google.com/googleplay/android-developer/answer/14151465 | lue |
| S22 | Google Play, niveau d'API cible | https://support.google.com/googleplay/android-developer/answer/11926878 | lue |
| S23 | Google Play, suppression de compte | https://support.google.com/googleplay/android-developer/answer/13327111 | lue |
| S24 | Google Play, section Sécurité des données | https://support.google.com/googleplay/android-developer/answer/10787469 | lue |
| S25 | Google Play, politique Données utilisateur | https://support.google.com/googleplay/android-developer/answer/10144311 | lue |
| S26 | Google Play, permissions de localisation | https://support.google.com/googleplay/android-developer/answer/9799150 | lue |
| S27 | Firebase, déclaration Play (FCM, Installations) | https://firebase.google.com/docs/android/play-data-disclosure | lue |
| S28 | Google Play, comptes développeur (vérification, coordonnées publiques) | https://support.google.com/googleplay/android-developer/answer/10841920 et https://support.google.com/googleplay/android-developer/answer/13634888 | lues |
| S29 | Fichiers locaux des bibliothèques (`node_modules`) | `react-native/gradle/libs.versions.toml:4` (`targetSdk = "36"`), `expo-notifications/android/.../AndroidManifest.xml`, `expo-location/.../AndroidManifest.xml`, `expo-image-picker/.../AndroidManifest.xml`, `*/ios/PrivacyInfo.xcprivacy` | lus directement |

### 0.2 Obtenues seulement par extraits de recherche (sources secondaires ou résumés de moteur) — à confirmer

| Id | Sujet | URL | Statut |
|---|---|---|---|
| T1 | DPF UE-États-Unis : arrêt du Tribunal du 3/09/2025 (T-553/23), pourvoi C-703/25 P pendant | https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework ; https://www.dataguidance.com/news/eu-cjeu-admits-microsoft-intervener-appeal-concerning | commentaires de cabinets/presse ; registre de la CJUE non consulté |
| T2 | Mapbox : DPA avec clauses types (annexe C), DPF, données stockées aux États-Unis | https://www.mapbox.com/privacy/ ; https://www.mapbox.com/dpa/subprocessors/ | seulement les extraits renvoyés par la recherche ; DPA non lu |
| T3 | Accessibilité : art. 47 loi 2005 (seuil 250 M€) ; directive (UE) 2019/882 applicable depuis le 28/06/2025 ; exemption des microentreprises prestataires de services | https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/la-nouvelle-directive-europeenne-accessibilite-pour-des-produits-et-des-services-accessibles-aux-personnes-en-situation ; https://handicap.gouv.fr/sites/handicap/files/2025-07/Fiche-conso-transports.pdf ; https://design.numerique.gouv.fr/articles/2025-07-31-european-accessibility-act/ | extraits de recherche d'origine officielle ; pages non ouvertes directement |
| T4 | NIS 2 : transposition française non achevée (projet « résilience » à l'Assemblée à partir du 7/10/2026) | https://next.ink/briefs/le-brief-du-23-septembre-2026/ | presse spécialisée |
| T5 | DSA art. 19 (exemption des micro et petites entreprises pour la section « plateformes ») | https://www.springlex.eu/fr/packages/dsa/dsa-regulation/article-19/ | texte consolidé par un éditeur juridique |
| T6 | Majorité numérique : 15 ans en France (art. 45 loi 78-17) | https://www.seban-associes.avocat.fr/la-cnil-publie-8-recommandations-pour-renforcer-la-protection-des-mineurs-en-ligne/?id=107219 | cabinet d'avocats, 2021 |
| T7 | Loi Evin (L. 3323-2 CSP), identification de la publicité (LCEN art. 20, C. conso L. 121-1), prospection (CPCE L. 34-5) | résultats de recherche (Sénat, ARPP, DGCCRF via presse) | **aucun texte consolidé lu** |
| T8 | Comptes développeur Apple : D-U-N-S, exonération de frais réservée aux organisations américaines | https://developer.apple.com/programs/enroll/ | extrait de recherche seulement |
| T9 | Vérification des développeurs Android (sideloading) : 30/09/2026 dans 4 pays, mondial en 2027 | https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/ | presse ; **hors périmètre France en 2026** |

### 0.3 Sources officielles NON accessibles aujourd'hui (donc « impossible à vérifier » pour le texte exact)

| Source | Ce qui s'est passé | Conséquence |
|---|---|---|
| EUR-Lex (RGPD, ePrivacy, DSA, EAA, AI Act, NIS 2) : `https://eur-lex.europa.eu/...` | réponse HTTP 202 (page de contrôle anti-robot), contenu vide, avec l'outil d'analyse comme avec `curl` | Texte officiel du RGPD **non relu**. Je m'appuie sur des miroirs non officiels (S4-S8) pour 5 articles et sur la citation qu'en fait la CNIL (S2). Le reste est « texte connu, à confirmer sur EUR-Lex » |
| Légifrance (loi 78-17 art. 82 et 45, CPCE L. 34-5, LCEN art. 6 et 20, CSP L. 3323-2, loi 2005-102 art. 47) | HTTP 403 / 404 | **Texte consolidé de l'art. 82 non relu.** Je cite la CNIL (S2 §3.1) qui le résume. Les autres articles : « impossible à vérifier » |
| cnil.fr (pages HTML, liste des traitements soumis à AIPD, fiche prospection) | HTTP 503 « Maintenance » | Seuls les PDF de la recommandation sur les applications mobiles ont pu être téléchargés. **Liste CNIL des AIPD, fiche sur la prospection et page sur la notification de violation : non lues** |
| Apple : manifestes de confidentialité et API à raison requise (`developer.apple.com/documentation/bundleresources/...`) | contenu rendu en JavaScript, page vide | L'outil a répondu **de mémoire** ; je n'en tiens pas compte. Je m'appuie sur S14 (Expo) et sur les fichiers `PrivacyInfo.xcprivacy` des bibliothèques (S29) |
| Google : page de déclaration du statut de « trader » (DSA) pour Play Console | non localisée ; S28 n'en parle pas | « impossible à vérifier » |
| Google : questionnaire IARC (classification), déclaration « contient des publicités », index Play des SDK | non consultés | à faire dans la console |

---

## 1. Inventaire factuel du traitement (état du dépôt)

### 1.1 Données traitées

| # | Donnée | Où elle naît | Où elle va | Conservation (code) | Preuve |
|---|---|---|---|---|---|
| D1 | **Identifiant d'appareil** : UUID aléatoire généré par l'appli, stocké dans SecureStore (Keychain/Keystore) ; en web `localStorage` | au premier lancement | envoyé à Supabase à chaque appel de fonction (`p_device_id`) | tant que l'appli n'est pas désinstallée **sur Android** ; **sur iOS le Keychain survit à la désinstallation** (S11) | `src/lib/deviceIdentity.ts:25-43`, `src/lib/authService.ts` (repli : l. 71-77, `USE_SUPABASE_ANONYMOUS_AUTH = false`) |
| D2 | Adresses découvertes + points + date | action de l'utilisateur (« découvrir ») | `user_place_discoveries` | effacement par l'utilisateur ou 24 mois sans activité | `src/lib/discoveryStore.ts:78-85, 178` ; `007:775-780` |
| D3 | Utilisations de cartes privilège (nombre, dates) | action | `user_discount_cards`, `discount_card_uses` | idem | `src/lib/discountCardsStore.ts` ; `007:777-778` |
| D4 | Likes (1 par appareil et par adresse) | action | `spot_user_likes` ; total public par adresse | idem (le total agrégé n'est pas décrémenté à l'effacement) | `006:~647-700` ; `006:624-627` |
| D5 | Suggestions d'adresses (texte libre jusqu'à 1000 caractères + D1) | action | `place_suggestions` | **jusqu'à effacement par l'utilisateur uniquement** : `purge_old_data` ne touche pas cette table | `src/lib/discoveryStore.ts:244-262` ; `006:760-775` ; `007:736-787` |
| D6 | Consultation d'une fiche (identifiant d'adresse, source `app`) | **automatique** à l'ouverture d'une fiche | `address_views` (insertion seule) | 13 mois | `src/components/AddressDetailModal.tsx:121-132` ; `006:736-749` ; `007:763` |
| D7 | Jeton Expo Push + plateforme + 3 préférences + D1 | l'utilisateur active le réglage puis accepte la permission système | `push_devices` | jusqu'à désactivation/effacement ; **supprimé après 270 jours sans mise à jour** ; invalidé puis supprimé 30 jours ; journaux d'envoi 30 jours | `src/lib/pushNotifications.ts:90-131` ; `007:63-74, 757-759, 751-755` |
| D8 | Journaux d'envoi : jeton, D1, statut, tickets, erreurs | serveur | `push_deliveries`, `push_outbox`, `push_requests` | 30 jours / 7 jours | `007:88-114, 751-756` |
| D9 | **Position GPS** (précision `High`) | à l'ouverture de la carte, au premier plan | **reste sur l'appareil** ; envoyée **à Mapbox (États-Unis)** avec la destination lors d'un itinéraire à pied ; la carte native est fournie par Apple Plans (iOS) / Google Maps (Android) | non enregistrée côté Le Petit Tou | `src/components/views/MapView.tsx:666-680, 920` |
| D10 | Tentatives de connexion admin (horodatage seulement) | portail admin | `admin_login_attempts` | 1 jour | `006:45-65` |
| D11 | Adresse IP, métadonnées réseau | toute requête | Supabase (journaux d'API), Expo, Mapbox, Apple/Google, hébergeurs d'images | **non maîtrisée** (durées des journaux non vérifiées) | — |
| D12 | Photos (bibliothèque) | **uniquement portail admin** | bucket `etablissements` | — | `AdminPortalModal.tsx:485-517` ; `app.json:62` |

Aucun SDK d'analyse, de publicité ou de suivi dans `package.json`. Aucun système d'IA (aucune dépendance de ce type).

### 1.2 Services tiers (destinataires et sous-traitants)

| Service | Donnée reçue | Rôle probable | Mécanisme de transfert | Contrat lu ? |
|---|---|---|---|---|
| **Supabase** (base, fonctions, stockage, journaux) | D1-D8, D10, D11 | sous-traitant (S9 §rôle) | CCT intégrées au DPA (modules 2 et 3), DPF non mentionné (S9) ; **région du projet inconnue** | DPA lu (S9) |
| **Expo / EAS** (service d'envoi push, compte `owner`) | jeton, contenu du message (titre, corps), IP | non précisé dans sa politique (S10) | auto-certification DPF déclarée, CCT « si nécessaire » (S10) | politique lue ; **DPA introuvable** |
| **Apple APNs** | jeton APNs, message | responsable distinct (transport) | — | non lu |
| **Google FCM / Firebase Installations** | jeton FCM, identifiant d'installation Firebase, user-agent (S27) | à qualifier | Firebase Data Processing Terms non lus | non lu |
| **Google Maps SDK (Android)** | IP, requêtes de tuiles | à qualifier | — | non lu |
| **Apple Plans (iOS)** | idem | — | — | non lu |
| **Mapbox** (Directions API, carte web) | position + destination (itinéraire), IP, jeton | prestataire | DPF + CCT selon la recherche (T2) | **non lu** |
| `images.unsplash.com`, hébergeurs d'images, `unpkg.com` (web) | IP | tiers | — | — |
| `api-adresse.data.gouv.fr` (portail admin seulement) | texte d'adresse saisi par l'admin | autorité publique française | UE | — |

### 1.3 Permissions déclarées

**iOS** (`app.json:14-18, 59-82`) : `NSLocationWhenInUseUsageDescription` (texte explicite, l. 16) ; photothèque (texte d'usage via `expo-image-picker`, l. 62, caméra et micro désactivés) ; notifications (permission système, plugin `expo-notifications`). Le plugin `expo-location` ajoute en plus des chaînes `NSLocationAlways…` sans mode d'arrière-plan (`node_modules/expo-location/plugin/build/withLocation.js:111-117` ; déjà relevé en C-03). `ITSAppUsesNonExemptEncryption: false` (l. 17). `supportsTablet: true` (l. 13).

**Android** déclarées (`app.json:29-32`) : `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`. Ajoutées par les bibliothèques : `POST_NOTIFICATIONS` et `RECEIVE_BOOT_COMPLETED` (`expo-notifications/android/src/main/AndroidManifest.xml:2-3`). Retirées (`blockedPermissions`, `app.json:34-40`) : `RECORD_AUDIO`, `CAMERA`, `READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`. `allowBackup: false` (nouveau, l. 22). Le manifeste fusionné n'a pas été regénéré aujourd'hui : **impossible à vérifier sans `prebuild`/AAB** (l'audit du 19/10 dit l'avoir relu).

**Niveau d'API cible** : `targetSdk = "36"` dans le catalogue de React Native 0.86 (`node_modules/react-native/gradle/libs.versions.toml:4`). `expo-build-properties` n'est pas installé, donc pas de surcharge dans le dépôt. À confirmer sur l'AAB produit.

---

## 2. Corrections aux affirmations du rapport du 19/10 (et de ses annexes)

| # | Affirmation | Où | Constat aujourd'hui | Gravité |
|---|---|---|---|---|
| A1 | « Aucune notification n'est implémentée » ; « APNs non requis : aucune push » | `01` l. 51 (tableau B), l. 129 est déjà corrigé par l'addendum, **l. 174 (checklist G)** | **Périmé** : push implémentée et déployée (04 §1). APNs et FCM sont nécessaires. | moyenne |
| A2 | D-04 « Aucune durée de conservation appliquée » | `01` l. 88 | **Périmé** : `purge_old_data` existe (`007:736-787`), planifiée (04 §1). Mais **incomplète** (voir J-02). | moyenne |
| A3 | C-02 « dépendances `expo-notifications` et `expo-device` supprimées » | `01` l. 91 | **Périmé** : réinstallées et utilisées (`package.json`, `pushNotifications.ts:3-4`). | faible |
| A4 | « Réinstaller l'appli remet à zéro progression et quotas » ; S-16 | `02` l. 118 ; `01` l. 81 | **Faux sur iOS** : le Keychain persiste après désinstallation/réinstallation avec le même `bundleIdentifier`, sans garantie (S11). Vrai sur Android (S11 : données non conservées, sauvegarde automatique ne restaure pas SecureStore). Conséquences : (i) les quotas des cartes privilège ne se réinitialisent pas sur iOS par réinstallation ; (ii) le texte de `public/suppression-donnees.html:24-26` (« si vous avez désinstallé… ») est faux pour iOS ; (iii) l'ID est un identifiant persistant plus durable que ce que dit la politique. | moyenne |
| A5 | N-08 (04) « la sauvegarde cloud Android pouvait cloner l'identifiant » | `04` §2 | **Douteux** : S11 indique que la sauvegarde automatique ne peut pas restaurer les entrées SecureStore (clés Keystore supprimées à la désinstallation). `allowBackup: false` reste une bonne mesure ; la gravité décrite est surestimée. | faible |
| A6 | Art. 33-34 : « Un incident est probable » | `01` l. 115 | **Formulation trop forte.** Une vulnérabilité n'est pas en soi une violation de données. La qualification (accès non autorisé effectif ou non, risque pour les personnes) est à établir à partir des journaux. **Et le délai de 72 h (art. 33(1), cité par S2 l. 1391-1392) peut expirer vers le 22/10/2026** si l'association est réputée informée le 19/10 et qu'un risque est retenu. Voir J-10. | **haute (urgence)** |
| A7 | ePrivacy/CNIL : « Pas de traceur soumis à consentement relevé » | `01` l. 116 | **Incomplet.** L'identifiant d'appareil lu puis transmis relève de l'art. 5(3) ePrivacy / art. 82 LIL (S1 §3.5, S2 §3.1) ; l'absence de consentement repose alors sur l'exemption « strictement nécessaire au service expressément demandé », **à documenter** (J-14). | moyenne |
| A8 | Apple 5.1.1(i)-(v) : « suppression de compte non applicable (aucun compte) » | `01` l. 117 | **Nuancer.** La règle vise les apps qui permettent la création de compte, et Apple précise que les comptes « invité » générés automatiquement comptent (S16). Un identifiant d'appareil généré par l'appli n'est pas un compte au sens strict, mais l'appli propose déjà une suppression in-app : **conforme par précaution**. | faible |
| A9 | Brouillon d'étiquettes Apple : « ID de l'appareil … non lié à l'identité » | `02` l. 103 ; `01` l. 182 | **Incorrect** : Apple considère comme « liées à l'utilisateur » les données rattachées à son identité **via son compte, son appareil ou d'autres détails** (S18). Les données D1-D5 et D7 sont **liées**. | **haute (déclaration)** |
| A10 | Brouillon Play : « chiffrées en transit : oui ; suppression possible… oui » | `02` l. 104 | Cohérent avec S24, mais **incomplet** : il faut aussi déclarer les données collectées par les SDK (FCM : identifiant d'installation Firebase, S27 ; Google Maps SDK), la position envoyée à Mapbox et l'ID d'appareil (« les données pseudonymes doivent être déclarées », S24). | moyenne |
| A11 | « `targetSdk` exigé à la date de soumission » : non relevé | `01` l. 153, 175 | Précisable : **API 36 (Android 16) exigée pour les nouvelles applis et mises à jour depuis le 31/08/2026** ; extension possible jusqu'au 1/11/2026 pour les applis existantes (S22). Le modèle React Native 0.86 vise 36 (S29). | moyenne |
| A12 | `02-PUBLICATION.md` : liste des comptes sans mention du test fermé | `02` §0 | **Omission** : comptes **personnels** créés après le 13/11/2023 : test fermé avec **12 testeurs pendant 14 jours consécutifs** avant l'accès à la production (S21). L'exemption des comptes organisation n'est **pas** énoncée sur la page lue (une source secondaire la mentionne) : à confirmer dans la console. | **haute (calendrier)** |
| A13 | `02-PUBLICATION.md` : exigences Apple récentes absentes | `02` | **Omissions** (S17) : build avec **Xcode 26 / SDK iOS 26 depuis le 28/04/2026** ; cible de déploiement ≥ iOS 13 depuis le 9/09/2026 (satisfait : iOS 16.4 selon `01` l. 153) ; **nouveau questionnaire de classe d'âge** (échéance 31/01/2026) ; **statut de « trader » DSA** à déclarer dans App Store Connect (S20). | **haute** |
| A14 | Comptes des boutiques | `02` §0 | Pour une association (personne morale), Apple et Google demandent en pratique un **numéro D-U-N-S** pour un compte « organisation » (Apple : T8 ; Google : S28 « sauf organisme public connu »). Délai de délivrance non négligeable (T8 : jusqu'à ~30 jours ouvrés, source secondaire). Les coordonnées de l'éditeur (adresse issue du D-U-N-S, e-mail, téléphone) sont **publiées** sur les fiches. | moyenne |
| A15 | Comptes de tests : décompte | `01` l. 25 vs l. 14 | Incohérences internes (53/29 vs 63/54 tests) ; `04` indique désormais 74 et 76. Sans effet juridique. | faible |
| A16 | `006` : commentaire « Aucune notification push n'est émise par l'appli » | `src/scripts/006_security_lockdown.sql:750` | Commentaire périmé (table `user_push_tokens` héritée, fermée ; la nouvelle table est `push_devices`). | faible |
| A17 | Texte d'interface et pages web : « au plus 2 notifications par jour » | `NotificationSettingsModal.tsx:114` ; `PrivacyPolicyModal.tsx:161` ; `public/confidentialite.html` §3 | **Inexact** pour les annonces manuelles, qui contournent le plafond (`007:399`, confirmé par 04 §4 « ne compte pas dans le plafond »). | moyenne |
| A18 | Politique : « 24 mois sans activité » pour les suggestions (« Idem ») | `public/confidentialite.html` §1 tableau, ligne « Suggestions » | **Inexact** : `purge_old_data` n'efface pas `place_suggestions` (`007:736-787`) et l'« activité » ne compte ni les suggestions ni les jetons. | moyenne |
| A19 | Package | `package.json:42` | Entrée parasite `"undefined": "/private/tmp/claude-501/npmcache"` (introduite dans `83abdf4`) dans `dependencies`. **Hors périmètre juridique mais susceptible de casser `npm ci`/le build EAS.** | **haute (build)** |

---

## 3. Matrice juridique (synthèse)

| Id | Exigence | Nature | Applicabilité | Statut |
|---|---|---|---|---|
| J-01 | RGPD applicable ; l'ID d'appareil est une donnée personnelle | [L] art. 2-4, cons. 26 | Oui | **conforme** (qualification correctement posée) |
| J-02 | Art. 5 : minimisation, limitation de la conservation | [L] | Oui | **incomplet** |
| J-03 | Art. 6 : bases légales | [L] | Oui | **incomplet** |
| J-04 | Art. 12-14 : information | [L] | Oui | **incomplet** (placeholders, divergences) |
| J-05 | Art. 15-22 : droits | [L] | Oui | **incomplet** (accès/portabilité) |
| J-06 | Art. 25 : protection dès la conception | [L] | Oui | **incomplet** (ID créé et envoyé au 1er lancement) |
| J-07 | Art. 28 : sous-traitants | [L] | Oui | **incomplet** / **impossible à vérifier** (contrats) |
| J-08 | Art. 30 : registre | [L] | Oui (traitement non occasionnel) | **non conforme** (rien dans le dépôt) |
| J-09 | Art. 32 : sécurité | [L] | Oui | **incomplet** |
| J-10 | Art. 33-34 : violation | [L] | Oui | **à valider immédiatement** |
| J-11 | Art. 35 : AIPD | [L] | Probablement non requise | **non applicable (à valider)**, liste CNIL non lue |
| J-12 | Art. 37 : DPO | [L] | Probablement non | **non applicable (à valider)** |
| J-13 | Chap. V : transferts hors EEE | [L] | Oui | **incomplet** / **impossible à vérifier** |
| J-14 | ePrivacy / art. 82 LIL : lecture/écriture sur le terminal | [L] | Oui | **incomplet** |
| J-15 | Notifications : consentement ou exemption ; prospection | [L]/[R]/[P] | Oui | **incomplet** |
| J-16 | Géolocalisation | [L]/[R] | Oui | **conforme** sous réserve (précision, base légale à écrire) |
| J-17 | Mineurs | [L]/[P] | À valider | **à valider** |
| J-18 | Publicité / partenaires payants / consommation | [L] | À valider | **à valider** (texte non lu) |
| J-19 | Loi Evin | [L] | À valider | **à valider** (texte non lu) |
| J-20 | Mentions légales (LCEN art. 6) | [L] | Oui | **non conforme** (champs vides) |
| J-21 | DSA | [L] | Non en l'état | **non applicable (à valider)** |
| J-22 | DMA | [L] | Non | **non applicable** |
| J-23 | Règlement IA | [L] | Non | **non applicable** |
| J-24 | NIS 2 | [L] | Non | **non applicable (à valider)** |
| J-25 | Accessibilité (loi 2005, EAA) | [L] | Non en principe | **non applicable (à valider)** |
| J-26 | Droit de la consommation (CGV, rétractation) | [L] | Non en l'état (aucun paiement) | **non applicable (à valider)** |
| J-27 | Version web (localStorage, tiers) | [L] | Oui si la version web est publiée | **incomplet** |

---

## 4. Fiches détaillées

Format : (a) règle et source ; (b) article/section ; (c) applicabilité ; (d) état constaté ; (e) risque ; (f) correction ; (g) statut.

### J-01 — Donnée personnelle et applicabilité du RGPD
- **(a,b)** Une donnée est personnelle si elle concerne une personne identifiable, y compris par un « identifiant en ligne » (art. 4(1), S5). Les données pseudonymisées restent personnelles (art. 4(5), cons. 26, S5/S8 : test des moyens « raisonnablement susceptibles » d'être utilisés). La CNIL rappelle que les identifiants propres à une installation ou à un terminal sont des identifiants mobiles qui permettent de « suivre chaque utilisateur de manière unique » (S2 §3.1, encadré « le rôle des identifiants du mobile »). Texte officiel EUR-Lex non relu : voir §0.3. [L]
- **(c)** Oui : l'association est établie à Toulouse et offre le service en France.
- **(d)** La politique le reconnaît : « il s'agit d'une donnée personnelle au sens du RGPD » (`PrivacyPolicyModal.tsx:114`, `public/confidentialite.html` §1).
- **(e)** Faible. Nuance utile : l'art. 11 (S7) dispense de collecter des informations supplémentaires pour identifier une personne si la finalité ne l'exige pas, et suspend alors les art. 15-20 sauf si la personne fournit des informations permettant de l'identifier. Ici, l'ID n'est affiché nulle part, donc une personne qui écrit à `contact@lepetittou.net` ne peut pas prouver quelle ligne est la sienne (voir J-05).
- **(f)** Aucune. Garder la formulation.
- **(g)** **conforme.**

### J-02 — Art. 5 : minimisation et limitation de la conservation
- **(a,b)** Art. 5(1)(c) et (e) [L]. La CNIL attend que les durées soient strictement nécessaires et que les données identifiantes ne soient pas transmises sans nécessité (S2 §5.1, l. 1148, 1204-1205).
- **(c)** Oui.
- **(d)**
  - Purge : `purge_old_data` efface journaux (30 j), requêtes (7 j), jetons invalides (30 j) ou inactifs (270 j), consultations (13 mois), et les données D2-D4 des appareils sans activité depuis 24 mois (`007:751-787`). Tâche nocturne `lpt-purge` active selon 04.
  - **Trous** : (i) `place_suggestions` n'est jamais purgée automatiquement (A18) ; (ii) la « dernière activité » ne regarde que découvertes, utilisations de cartes et likes (`007:768-775`), donc un appareil qui n'a fait que des suggestions n'est jamais purgé ; (iii) la durée de 270 jours des jetons n'est écrite dans aucune politique (`public/confidentialite.html` §1 dit « jusqu'à désactivation ou effacement ») ; (iv) les journaux Supabase/Expo/Mapbox ont des durées non documentées.
  - Minimisation : `address_views` ne stocke aucun identifiant (OK, `006:736-749`, `user_id is null` imposé), mais l'IP reste visible dans les journaux d'API de Supabase ; la politique dit « sans identifiant » (§1) sans nuancer.
  - Position : `Location.Accuracy.High` + `ACCESS_FINE_LOCATION` (`MapView.tsx:675` ; `app.json:29-32`). La CNIL recommande de choisir la localisation approximative plutôt que précise si elle suffit (S2 §5.5, « Comment gérer l'usage de la localisation ? »).
- **(e)** Moyen : écart entre ce que dit la politique et ce que fait le code (A17, A18) = risque d'information inexacte (art. 13) plus que d'amende.
- **(f)** Ajouter `place_suggestions` à `purge_old_data` (durée à décider, p. ex. 12-24 mois ou « jusqu'à traitement ») ; inclure les suggestions dans le calcul d'activité ; écrire les durées réelles (jetons 270 j) dans les deux textes ; qualifier « sans identifiant » (IP techniquement journalisée par l'hébergeur) ; documenter pourquoi la précision `High` est nécessaire (itinéraire à pied) ou passer en `Balanced` pour le simple centrage.
- **(g)** **incomplet.**

### J-03 — Art. 6 : bases légales
- **(a,b)** Art. 6(1)(a) consentement, (b) contrat/service demandé, (f) intérêt légitime [L]. Le consentement doit pouvoir être retiré aussi simplement qu'il est donné (S2, résumé de recherche et art. 7 non relu).
- **(c)** Oui.
- **(d)** La politique annonce : exécution du service (progression, cartes), consentement (notifications, suggestions), intérêt légitime (statistiques, prévention des abus) (`PrivacyPolicyModal.tsx:136`, tableau web §1). **Aucune base n'est indiquée pour la position et les itinéraires (Mapbox)**, ni pour les journaux techniques et la sécurité des serveurs. Le « consentement » pour les suggestions est discutable : l'envoi volontaire d'un formulaire relève plutôt de l'exécution d'une demande ; à trancher pour éviter de promettre un retrait impossible.
- **(e)** Faible à moyen (information).
- **(f)** Compléter : itinéraire = exécution du service demandé (art. 6(1)(b)) ou consentement, au choix, mais le dire ; sécurité = intérêt légitime ; clarifier la base de la suggestion.
- **(g)** **incomplet.** Choix final **à valider** par un juriste.

### J-04 — Art. 12-14 : information des personnes
- **(a,b)** Art. 13 (contenu : identité, finalités, bases, destinataires, transferts et garanties, durées, droits, retrait du consentement, réclamation) [L]. Apple 5.1.1(i) et Google (S25 « Privacy Policy ») exigent en plus une politique **accessible depuis l'appli et depuis la fiche** [P] : la politique doit couvrir données collectées, destinataires, **conservation et suppression**, coordonnées ; Google : page publique, non modifiable, **pas un PDF** (S25).
- **(c)** Oui.
- **(d)**
  - Dans l'appli : modale complète mais **sans** région d'hébergement, **sans** mécanisme de transfert (seulement « États-Unis »), sans mention de Firebase/FCM (`PrivacyPolicyModal.tsx:175-185`). Date « 19 octobre 2026 » (l. 101) alors que le comportement a changé depuis (A17, A18).
  - Page web : **5 champs `[À COMPLÉTER]`/`[À VÉRIFIER]`** (`public/mentions-legales.html:20, 22, 24, 25` ; `public/confidentialite.html:41, 44`).
  - Les deux textes diffèrent (tableau et §7 « Sécurité » seulement sur le web).
  - Aucune URL publique encore définie (D-02 ouvert). Le lien depuis l'appli existe (`HomeView.tsx:2034-2038`).
- **(e)** **Haut pour la publication** : Apple 2.1(a) (« supprimer les contenus provisoires… URL fonctionnelles », S15) et Google exigent une politique valide ; des placeholders visibles peuvent entraîner un rejet.
- **(f)** Compléter les 5 champs ; aligner la modale sur la page web (une seule source de vérité) ; ajouter région, mécanismes de transfert, Firebase/FCM, durées réelles, base légale de la position, mention « journaux techniques/IP chez les hébergeurs » ; héberger les 3 pages en HTML ; mettre à jour les dates.
- **(g)** **incomplet** (non conforme tant que les placeholders subsistent).

### J-05 — Art. 15-22 : droits des personnes
- **(a,b)** Art. 12(3) (réponse sous un mois), 15 (accès), 16, 17 (effacement), 18, 20 (portabilité), 21 [L]. La CNIL recommande de permettre l'exercice des droits **dans l'application**, via une page dédiée, en utilisant l'identifiant déjà collecté (S2 §6.2, l. ~2140-2146) [R]. Art. 11 (S7) encadre le cas des données non identifiantes.
- **(c)** Oui.
- **(d)**
  - Effacement : bouton « Effacer mes données » (`PrivacyPolicyModal.tsx:57-67, 200-212`) ; logique `src/lib/dataDeletion.ts:21-53` ; fonction serveur `delete_my_data` (version 007 : découvertes, cartes, utilisations, suggestions, likes, anciens jetons, `push_deliveries`, `push_devices`, compte auth éventuel ; `007:683-730`). Le compteur public de likes n'est pas décrémenté (`006:624-627`), ce qui est dit dans le code mais **pas dans la politique** ni dans la page de suppression (qui parle seulement de « compteurs agrégés », §« Ce que nous conservons »).
  - Accès/portabilité : **aucune fonction d'export** ; la politique renvoie à un e-mail. L'ID n'est visible nulle part dans l'appli ; sans lui, aucune réponse fiable n'est possible.
  - Retrait du consentement notifications : interrupteur (`NotificationSettingsModal.tsx:116-122`) ; effacement du jeton côté serveur (`pushNotifications.ts:150-160`).
  - Pas de procédure interne de réponse (délai d'un mois, vérification d'identité) dans le dépôt.
- **(e)** Moyen : une demande d'accès ne pourrait pas être traitée proprement.
- **(f)** Afficher « Mon identifiant » dans l'écran de confidentialité (copiable), ajouter un export JSON des données liées à cet identifiant (fonction serveur de lecture), écrire la procédure (réponse sous un mois, preuve de possession de l'ID, application de l'art. 11) ; préciser dans la politique que les totaux publics de likes ne sont pas rectifiés.
- **(g)** **incomplet.**

### J-06 — Art. 25 : protection des données dès la conception
- **(a,b)** Art. 25(1)-(2) [L]. La CNIL suggère un écran d'information au premier lancement (S2 §6.2, l. ~2150-2152) [BP] et la minimisation des identifiants transmis [R].
- **(c)** Oui.
- **(d)** L'ID est créé (`deviceIdentity.ts`) et **envoyé à Supabase dès le premier lancement**, avant toute action de l'utilisateur : `discoveryStore` et `discountCardsStore` appellent `syncWithSupabase()` dans leur constructeur (`discoveryStore.ts:33-40, 78-85` ; `discountCardsStore.ts:121-129`). La fonction `get_my_discoveries` reçoit l'ID même pour un utilisateur qui n'a rien demandé. Positif : ID aléatoire, tables fermées, fonctions à droits limités (`006:393-410`), notifications désactivées par défaut.
- **(e)** Moyen : cela affaiblit l'exemption « service expressément demandé » (J-14) et la règle Apple 5.1.1(ii) (consentement pour la collecte de données d'usage, même anonymes, S15).
- **(f)** Créer l'ID **à la première action utilisateur** (découvrir, liker, utiliser une carte, activer les notifications) ; ne pas appeler `get_my_discoveries` tant qu'aucun ID n'existe ; ou ajouter un écran d'information au premier lancement.
- **(g)** **incomplet.**

### J-07 — Art. 28 : sous-traitants
- **(a,b)** Art. 28(3) : contrat de sous-traitance [L]. Art. 26 si responsabilité conjointe (non étudié).
- **(c)** Oui pour Supabase (hébergement), et probablement Expo (envoi). Apple/Google (APNs/FCM) agissent pour leur compte propre.
- **(d)** Supabase : DPA publié, applicable par acceptation du contrat, CCT intégrées, notification d'incident « dans les 48 h » (S9). **Je ne peux pas dire si le DPA a été accepté/signé dans le compte, ni quelle est la région du projet.** Expo : politique lue, rôle non précisé, **DPA non trouvé** (S10). Mapbox : DPA et CCT d'après la recherche (T2), non lus. Firebase : non lus.
- **(e)** Moyen (document manquant) ; élevé si une ressource sensible partait hors UE.
- **(f)** Télécharger/archiver le DPA Supabase et vérifier la région ; demander à Expo si le service de notifications fait l'objet d'un DPA, sinon documenter l'analyse (jeton + message public, donnée non sensible) ; archiver les conditions Mapbox et Firebase.
- **(g)** **incomplet** (Supabase) ; **impossible à vérifier** (Expo, Mapbox, Firebase).

### J-08 — Art. 30 : registre des activités de traitement
- **(a,b)** Art. 30(1) ; 30(5) : l'exemption des organisations de moins de 250 personnes **ne vaut pas** si le traitement n'est pas occasionnel, présente un risque, ou touche des catégories particulières (S4) [L].
- **(c)** Oui : le traitement est permanent (la condition « non occasionnel » suffit à écarter l'exemption).
- **(d)** Le rapport du 19/10 le classe en « action restante » (`01` l. 108). **Aucun registre dans le dépôt.** Le §1.1 de ce rapport peut servir de base (finalités, catégories, destinataires, durées).
- **(e)** Faible en pratique, mais il est exigible à tout contrôle.
- **(f)** Créer un registre (hors dépôt si besoin), avec transferts et mesures de sécurité.
- **(g)** **non conforme** (non trouvé) ; la tenue hors dépôt est **impossible à vérifier**.

### J-09 — Art. 32 : sécurité
- **(a,b)** Art. 32 [L]. Apple/Google : transmission chiffrée, minimisation (S15 5.1.1(iii) ; S25 « Personal and Sensitive User Data »).
- **(c)** Oui.
- **(d)** Selon 04 §1 : contrôle de production « tout conforme » après 006 et 007 ; surface exposée limitée à 17 fonctions nommées (`04` §3). Je n'ai rien exécuté. Points restants lus dans les documents du dépôt :
  - **Envoi Expo non authentifié** : `push_send` poste vers `exp.host` sans en-tête d'autorisation (`007:443-446`). Expo documente que, par défaut, seul le jeton suffit à envoyer, et propose une « sécurité renforcée » avec jeton d'accès EAS (S13). Les jetons ne sont lisibles que via la table fermée, mais une fuite permettrait d'envoyer de fausses notifications en se faisant passer pour l'appli.
  - Écriture anonyme dans le bucket photos (N-10, ouvert), verrouillage admin global (N-09, ouvert).
  - Inscriptions e-mail/Google Supabase à fermer (S-10 ; `04` n'en parle plus : **à confirmer**).
  - Portail admin dans l'appli publique (S-19), accès par 7 appuis sur le logo.
  - Jeton Mapbox public dans l'URL de requête (`MapView.tsx:920`) : normal pour un jeton `pk.` restreint, à restreindre par URL/identifiant d'appli.
  - Journaux d'administration : aucun journal d'activité des actions admin (`04` §3).
- **(e)** Moyen.
- **(f)** Activer la sécurité renforcée des notifications Expo et ajouter l'en-tête `Authorization` (secret dans Supabase Vault) ; traiter N-09/N-10 ; confirmer S-10 ; restreindre le jeton Mapbox.
- **(g)** **incomplet** ; l'état de production est **impossible à vérifier** dans cette mission.

### J-10 — Art. 33-34 : violation de données
- **(a,b)** Art. 33(1) : notification à l'autorité « dans les meilleurs délais et, si possible, 72 heures au plus tard après en avoir pris connaissance », sauf si la violation n'est pas susceptible d'engendrer un risque ; art. 33(5) : documentation interne de toute violation ; art. 34 : information des personnes si risque élevé [L]. Le délai de 72 h est rappelé par la CNIL (S2, l. 1391-1392). Texte EUR-Lex et page CNIL « notifier une violation » : non lus.
- **(c)** Oui si une violation au sens de l'art. 4(12) est établie (accès non autorisé effectif à des données personnelles).
- **(d)** Faits du rapport 01 : avant 006, `user_place_discoveries` était lisible par tous (3 lignes avec `device_id`), `place_suggestions` lisible, base modifiable, code admin public. Ce que **je ne sais pas** : si un tiers a effectivement lu ces données ; combien de temps l'exposition a duré ; la durée de rétention des journaux d'API Supabase. Les accès de l'audit lui-même (lecture de 3 lignes) ne constituent pas, à mon sens, une violation commise par un tiers malveillant, mais cela reste à qualifier.
- **(e)** **Calendrier** : si l'association est réputée avoir eu connaissance de l'exposition le **19/10/2026** et que la violation est retenue avec un risque, la fenêtre de 72 h se termine vers le **22/10/2026**. Si aucune violation n'est retenue, il faut quand même **consigner l'analyse** (art. 33(5)).
- **(f)** Décision humaine immédiate (association + DPO/juriste) : consulter les journaux Supabase (si conservés) pour détecter des lectures/écritures anormales sur la période d'exposition ; conclure par écrit « violation / pas de violation / risque » ; notifier via le téléservice de la CNIL si requis ; sinon archiver l'analyse.
- **(g)** **à valider immédiatement** (statut de fond : impossible à vérifier).

### J-11 — Art. 35 : analyse d'impact (AIPD)
- **(a,b)** Art. 35(1), (3) ; listes de la CNIL [L]/[R]. **Liste CNIL non lue (503).**
- **(c)** Les critères usuels (traitement à grande échelle, données sensibles, surveillance systématique, personnes vulnérables, croisement) ne paraissent pas réunis : identifiant pseudonyme, pas de profilage, pas de position conservée, public non ciblé.
- **(d)** Aucune AIPD dans le dépôt.
- **(e)** Faible.
- **(f)** Consigner brièvement la raison pour laquelle l'AIPD n'est pas nécessaire (registre, J-08) ; réexaminer si l'appli grandit ou si des avis publics/une géolocalisation continue sont ajoutés.
- **(g)** **non applicable (à valider).**

### J-12 — Art. 37 : DPO
- **(a,b)** Art. 37(1) [L] : obligatoire pour un organisme public, ou en cas de suivi régulier et systématique à grande échelle ou de traitement à grande échelle de données sensibles. Texte non relu.
- **(c,d)** Non en l'état (association, petite échelle). Contact : `contact@lepetittou.net`.
- **(g)** **non applicable (à valider).** Faculté de désigner un référent à titre de bonne pratique.

### J-13 — Chapitre V : transferts hors de l'EEE
- **(a,b)** Art. 44-46 : transfert permis vers un pays adéquat (DPF pour les entreprises certifiées), ou avec garanties (CCT), sinon dérogations (art. 49) [L]. Le DPF reste en vigueur : le Tribunal de l'UE a rejeté le recours Latombe le 3/09/2025 ; un pourvoi (C-703/25 P) est pendant (T1, sources secondaires ; registre de la CJUE non consulté).
- **(c)** Oui.
- **(d)**
  - Supabase : CCT dans le DPA (S9) ; région inconnue (l'hébergement dans l'UE réduirait l'enjeu).
  - Expo (États-Unis) : se dit certifiée DPF et prête à utiliser des CCT (S10). **Je n'ai pas consulté la liste officielle du DPF** (dataprivacyframework.gov) pour confirmer la certification.
  - Mapbox : données stockées dans une région AWS américaine, DPF + CCT selon la recherche (T2) ; la position et la destination partent en clair dans l'URL d'une requête HTTPS (`MapView.tsx:920`).
  - Apple/Google : réseaux de notification mondiaux.
  - La politique écrit « clauses contractuelles types ou décision d'adéquation » et garde un `[À VÉRIFIER avec chaque contrat]` (`public/confidentialite.html:44`).
- **(e)** Moyen.
- **(f)** Vérifier la certification DPF d'Expo et de Mapbox sur la liste officielle (date et périmètre « données non RH »), archiver leur DPA/CCT, écrire dans la politique le mécanisme **par destinataire** (pas un « ou »), prévoir un plan B si le DPF était invalidé (bascule vers CCT).
- **(g)** **incomplet** ; certifications **impossibles à vérifier** aujourd'hui.

### J-14 — Lecture/écriture sur le terminal (ePrivacy art. 5(3) ; art. 82 loi Informatique et Libertés)
- **(a,b)** Le consentement est requis avant toute lecture/écriture d'informations sur le terminal, sauf finalité exclusive de communication ou opération **strictement nécessaire à la fourniture d'un service expressément demandé** (rappel dans S2 §3.1 et S1 note 4) [L]. L'EDPB considère que la collecte d'un « identifiant unique » par un site ou une appli mobile constitue un « gaining of access » : l'art. 5(3) s'applique (S1 §3.5, 2e paragraphe). L'exemption est analysée **par l'éditeur avec le développeur** (S2 §6.2). **Le texte consolidé de l'art. 82 n'a pas pu être relu (Légifrance 403) ; la qualification repose sur S1 et S2.**
- **(c)** Oui : stockage de l'ID dans SecureStore/`localStorage` puis transmission au serveur ; jeton de notification (J-15).
- **(d)** Pas de mesure d'audience ni de publicité (`package.json`). L'ID sert à la progression, aux cartes, aux likes, aux suggestions : fonctions demandées par l'utilisateur, **mais** il est lu et envoyé dès le démarrage (J-06). `address_views` n'envoie aucun ID (hors IP).
- **(e)** Moyen : sans analyse écrite de l'exemption, la position « pas de consentement requis » est fragile, surtout pour la partie « au premier lancement ».
- **(f)** Écrire l'analyse (finalité par finalité) ; différer la création/l'envoi de l'ID jusqu'à une action utilisateur (J-06) ; documenter que la durée de vie est limitée (purge 24 mois) ; **ne pas** ajouter d'analytics ou de SDK publicitaire sans consentement.
- **(g)** **incomplet.**

### J-15 — Notifications push : consentement, exemption, prospection
- **(a,b)**
  - **Obligation légale.** Aucune source officielle lue aujourd'hui n'énonce que *toute* notification push exige un consentement RGPD distinct. La recommandation CNIL sur les applications mobiles (S2) ne traite pas le consentement aux push en tant que tel ; elle recommande de **limiter le contenu affiché** et, si possible, de le chiffrer (S2 §6.2, l. 2164-2167) [R] et rappelle que les permissions du système d'exploitation « n'ont pas pour objet de répondre à des obligations légales » (S2 §5.5, l. ~1508-1510). Le jeton est une information lue sur le terminal (API du système) puis transmise : art. 82 / 5(3) potentiellement applicable (S1 §3.5) ; l'exemption « service expressément demandé » est plausible quand l'utilisateur **active lui-même** les notifications.
  - **Distinction notification de service / prospection.** La prospection par voie électronique exige un consentement préalable (CPCE L. 34-5, T7), mais je **n'ai pas lu** ce texte ni de position de la CNIL sur les push ; je ne tranche pas si un push promotionnel y entre. Les notifications de ce projet sont éditoriales (nouvel événement, nouvelle adresse, agenda), mais « Agenda des partenaires » et les annonces libres peuvent promouvoir des partenaires qui paient (voir J-18).
  - **Règle de plateforme (Apple 4.5.4)** : push non requise pour le fonctionnement, pas d'information sensible, push **promotionnelles** soumises à un opt-in explicite par un texte d'invitation dans l'appli **et** à une option de désactivation dans l'appli (S15) [P]. Apple 5.1.2(i) : on ne peut pas imposer d'activer les push pour accéder à une fonction (S15).
- **(c)** Oui.
- **(d)**
  - Désactivées par défaut ; demande de permission au moment où l'utilisateur active l'interrupteur (`pushNotifications.ts:104-131`, `NotificationSettingsModal.tsx:58-68`) ; préférences par type (`pushLogic.ts` : événements et agenda `true`, nouvelles adresses `false` une fois les notifications activées) ; désactivation et effacement des jetons (`pushNotifications.ts:150-160`, `007:229-244`).
  - Contenu : titre/corps courts, sans donnée personnelle (`007:259`).
  - Promesse « au plus 2 par jour, jamais la nuit » (UI et pages) : **inexacte** pour les annonces (`007:399`) ; la limite nocturne n'est contrôlée qu'à la distribution, pas aux relances (`007:366-368` ; `push_send` `007:416-455`).
  - Canal Android créé avant la demande de permission (`pushNotifications.ts:43-48`) : conforme à la consigne d'Expo pour Android 13+ (S12).
  - Texte d'invitation : l'interrupteur et son libellé « Recevoir les notifications » + « Au plus 2 par jour, jamais la nuit » (`NotificationSettingsModal.tsx:113-115`). Il ne dit pas que les messages peuvent émaner de partenaires.
- **(e)** Moyen : promesse inexacte ; risque de rejet Apple si une push est jugée promotionnelle sans le bon texte d'invitation.
- **(f)** Aligner la promesse (soit l'annonce compte dans le plafond, soit le texte dit « hors annonces importantes ») ; contrôler les heures calmes aussi dans `push_send` ; préciser dans l'écran « vous pouvez recevoir des actualités de partenaires » si c'est le cas ; maintenir le désactivé par défaut et l'opt-out in-app.
- **(g)** **incomplet** (obligation de consentement exact : **impossible à vérifier** avec les sources lues).

### J-16 — Géolocalisation
- **(a,b)** Art. 5(1)(c) ; CNIL : préférer approximative à précise, premier plan à permanent, proposer une alternative manuelle (S2 §5.5, l. 1575-1590) [R]. L'accès au GPS pour une fonction de localisation demandée figure parmi les cas où le consentement n'est pas requis (S2 §5.1, tableau d'exemptions) ; la collecte de localisation « à des fins de recommandation de contenus » exige le consentement. Apple 5.1.5 (consentement et finalité expliquée) et 5.1.1(iv) (alternative si refus) ; Google : le premier plan est préféré, pas de formulaire pour le seul premier plan (la page ne le dit pas expressément : « confirmer dans la console », S26) [P].
- **(c)** Oui.
- **(d)** Premier plan seulement (`app.json:70, 72-74` ; plugin sans arrière-plan) ; demandée à l'ouverture de la carte ; un refus ne bloque rien (`MapView.tsx:666-680, 705-740`) ; position non enregistrée ; envoyée à Mapbox pour un itinéraire (`MapView.tsx:920`) ; précision `High`, permissions `FINE` + `COARSE`.
- **(e)** Faible à moyen.
- **(f)** Écrire la base légale de l'itinéraire (J-03) ; documenter la nécessité de la précision ; si l'on ne garde que le centrage et les distances, `Balanced` suffirait ; retirer les chaînes `NSLocationAlways…` si possible ; expliquer à l'utilisateur, au moment de l'itinéraire, que la position est envoyée à Mapbox.
- **(g)** **conforme** sous réserve (documentation) ; message d'information Mapbox **incomplet**.

### J-17 — Mineurs
- **(a,b)** RGPD art. 8 (S6) : âge du consentement 16 ans par défaut, abaissable jusqu'à 13 ; **15 ans en France** (T6, art. 45 de la loi 78-17, texte non relu) pour les services de la société de l'information offerts directement à un enfant [L]. Apple : classe d'âge honnête (2.3.6, S15) ; nouveau système 4+/9+/13+/16+/18+ ; références à l'alcool « peu fréquentes » → 13+, « fréquentes » → 18+ (S19). Google : questionnaire IARC (non lu).
- **(c)** Public non ciblé, mais l'appli recense bars et restaurants ; personne n'est exclu par une vérification d'âge.
- **(d)** Aucune vérification d'âge ; classification des boutiques à faire (`01` l. 123 : « non évalué »).
- **(e)** Faible juridiquement ; **bloquant pour la soumission** (questionnaire obligatoire).
- **(f)** Répondre au questionnaire en comptant les adresses de bars comme références à l'alcool ; indiquer dans la politique que l'appli n'est pas destinée aux moins de 15 ans (si c'est le cas) ; ne pas utiliser de vocabulaire « enfants » (Apple 5.1.4).
- **(g)** **à valider.**

### J-18 — Publicité, partenaires payants, consommation
- **(a,b)** Identification des publicités (LCEN art. 20, C. conso L. 121-1 et s.), pratiques commerciales trompeuses : **textes non lus** (T7, résultats de recherche indiquant que la DGCCRF attend une mention claire de toute collaboration rémunérée). [L] à confirmer.
- **(c)** Applicable si les partenaires paient pour apparaître ou être mis en avant : `sponsored_partners.price_paid` existe (`01` S-12).
- **(d)** La section de l'accueil s'intitule « Top Partenaires Le Petit Tou » avec un badge **« OFFICIEL »** (`HomeView.tsx:1663-1665`). Rien n'indique « sponsorisé » ou « publicité ». Cartes privilège : gratuites, aucune vente dans l'appli ; mentions légales : « le Petit Tou n'est pas partie à la vente » (`public/mentions-legales.html` §Cartes privilège). Pas de CGU.
- **(e)** Moyen : risque de présentation trompeuse d'un classement payant ; le mot « officiel » peut induire en erreur.
- **(f)** Faire valider par un juriste ; envisager « Partenaires (contenu sponsorisé) » ; adapter la réponse « l'appli contient-elle des publicités ? » dans Play Console (déclaration non lue).
- **(g)** **à valider.**

### J-19 — Loi Evin (publicité pour les boissons alcooliques)
- **(a,b)** CSP L. 3323-2 et suivants : publicité pour l'alcool limitée à des supports et contenus listés ; mention sanitaire (T7, **sources secondaires de 2008-2016, texte non lu**).
- **(c)** Applicable seulement si des partenaires sponsorisés promeuvent des boissons alcooliques (bars, caves).
- **(d)** Non évalué dans le dépôt.
- **(e)** À qualifier.
- **(f)** Demander l'avis d'un juriste sur le contenu des fiches partenaires et des annonces push (jamais d'incitation à boire).
- **(g)** **à valider.**

### J-20 — Mentions légales (LCEN art. 6)
- **(a,b)** LCEN art. 6 : identification de l'éditeur (association : dénomination, siège, directeur de la publication, contact) et de l'hébergeur [L]. **Texte non relu (Légifrance inaccessible).**
- **(c)** Oui pour un site/service accessible au public.
- **(d)** `public/mentions-legales.html:20` (RNA/SIREN), `:22` (directeur de la publication), `:24` (hébergeur Supabase : adresse et région), `:25` (hébergeur du site).
- **(e)** Moyen pour la loi ; **haut pour Apple/Google** (URL avec contenu provisoire).
- **(f)** Compléter, y compris l'hébergeur du site statique.
- **(g)** **non conforme** tant que les champs ne sont pas remplis.

### J-21 — Règlement sur les services numériques (DSA)
- **(a,b)** Règlement (UE) 2022/2065 [L]. Art. 19 : la section « plateformes » ne s'applique pas aux micro et petites entreprises (T5).
- **(c)** L'appli ne stocke pas de contenu d'utilisateurs pour le diffuser au public : les suggestions ne sont lisibles que par l'équipe (`006:760-775`), il n'y a ni avis ni commentaires publics. Elle n'est donc pas une « plateforme en ligne » ; la question de savoir si le simple stockage de suggestions fait de l'éditeur un « service d'hébergement » est **à valider**, sans conséquence pratique en l'état.
- **(d)** Rien de public. Distinction importante : **les boutiques** appliquent le DSA aux développeurs (statut de trader, S20) : c'est une règle de plateforme à traiter en §5/§6.
- **(g)** **non applicable (à valider)** ; à réexaminer si des avis ou contenus publics sont ajoutés.

### J-22 — Règlement sur les marchés numériques (DMA)
- **(a,b)** Règlement (UE) 2022/1925 : obligations des seuls contrôleurs d'accès [L] (mentionné par S2 p. 4 comme règle distincte).
- **(c,g)** L'association n'est pas un contrôleur d'accès : **non applicable.**

### J-23 — Règlement sur l'intelligence artificielle
- **(a,b)** Règlement (UE) 2024/1689 [L] ; texte non relu.
- **(c,d)** Aucun système d'IA dans `package.json` ni dans le code relu ; les pages n'évoquent aucune IA.
- **(g)** **non applicable.** À rouvrir si un composant d'IA est intégré (p. ex. recommandation, chatbot).

### J-24 — NIS 2
- **(a,b)** Directive (UE) 2022/2555 [L]. Transposition française **non achevée** d'après la presse spécialisée (projet « résilience » inscrit à l'Assemblée à partir du 7/10/2026, T4).
- **(c)** Une association de guide d'adresses n'entre pas dans les secteurs listés ; l'appli n'est ni une place de marché en ligne ni un réseau social (à confirmer avec le texte final).
- **(g)** **non applicable (à valider)**, source secondaire.

### J-25 — Accessibilité numérique
- **(a,b)** Loi 2005-102 art. 47 (organismes publics et personnes morales privées de plus de 250 M€ de chiffre d'affaires en France) ; directive (UE) 2019/882 applicable depuis le 28/06/2025 aux services listés (commerce électronique, services bancaires, transport, médias audiovisuels, communications électroniques), avec **exemption des microentreprises prestataires de services** (moins de 10 personnes et ≤ 2 M€) (T3). [L]
- **(c)** Une association gratuite sans vente en ligne ne paraît pas dans le champ ; **à valider** si la billetterie « partenaire » (redirection, `HomeView.tsx:2055-2083`) était un service de commerce électronique de l'association.
- **(d)** `01` : 42 propriétés d'accessibilité pour 168 `Pressable`, lecteur d'écran jamais testé.
- **(g)** **non applicable (à valider).** **Bonne pratique [BP]** : tester VoiceOver/TalkBack avant publication (Apple et Google peuvent le relever en révision, mais ce n'est pas une règle que j'aie lue).

### J-26 — Droit de la consommation (CGV, rétractation)
- **(c,d)** Aucun paiement dans l'appli ; la « carte privilège » est une offre gratuite des partenaires ; billetterie externe.
- **(g)** **non applicable (à valider)**. Les CGU ne sont pas obligatoires pour un service gratuit ; **recommandées** pour encadrer les suggestions et le portail admin [BP].

### J-27 — Version web
- **(a,b)** Mêmes règles qu'en J-14 pour `localStorage` (S1 §3).
- **(c)** Applicable **si l'export web est déployé**. `public/` est destiné à l'export web (`02` §6) ; l'existence d'une version web publique n'est pas établie.
- **(d)** ID en `localStorage` (`deviceIdentity.ts:25-35`) ; l'iframe Mapbox GL charge `https://unpkg.com/supercluster@8.0.1/...` (`mapboxHtmlTemplate.ts:19`) et les scripts/styles de `api.mapbox.com` : les tiers voient l'IP. La télémétrie de Mapbox GL JS n'a pas été vérifiée.
- **(f)** Si le web est publié : auto-héberger `supercluster`, vérifier la télémétrie Mapbox, ajouter les mentions d'information adaptées ; sinon ne pas publier le web.
- **(g)** **incomplet** / **impossible à vérifier** (déploiement inconnu).

---

## 5. Checklist App Store (Apple)

Les règles de plateforme [P] sont des conditions d'approbation, pas des obligations légales. Source : S15 sauf mention.

| # | Exigence | État constaté (fichier:ligne) | Statut |
|---|---|---|---|
| AS-01 | Compte Apple Developer au nom de l'association (organisation, D-U-N-S) ; l'exonération de frais est réservée aux organisations américaines à but non lucratif (T8) | `02` §0 : compte « à ouvrir » | **à faire** ; **impossible à vérifier** (statut du compte) |
| AS-02 | **Statut de trader (DSA)** déclaré dans App Store Connect ; si « trader », adresse (issue du D-U-N-S), e-mail et téléphone vérifiés et **publiés** sur la fiche dans l'UE ; sinon « pas un compte trader » (S20) ; Apple dit que l'évaluation revient au développeur | absent de `02` | **non fait** ; réponse à décider (voir questions Q-14/Q-15) |
| AS-03 | Build avec Xcode 26 et SDK iOS 26 (depuis le 28/04/2026) ; cible de déploiement ≥ iOS 13 (depuis le 9/09/2026) (S17) | cible iOS 16.4 (`01` l. 153) ; image de build EAS non vérifiée | **impossible à vérifier** avant le build ; cible **conforme** |
| AS-04 | Questionnaire de **classe d'âge** à jour (nouveau système, S17/S19) ; réponse honnête (2.3.6) ; alcool « peu fréquent » → 13+, « fréquent » → 18+ | non évalué (`01` l. 123) | **à faire** |
| AS-05 | URL de politique de confidentialité dans App Store Connect **et** accessible dans l'appli (5.1.1(i)) | modale OK (`HomeView.tsx:2034-2038`) ; URL web **non hébergée**, 5 placeholders (J-04) | **non conforme** (tant que non hébergée/complétée) |
| AS-06 | Politique couvrant données, destinataires, **conservation et suppression**, retrait du consentement (5.1.1(i)) | partiel (J-02, J-04) | **incomplet** |
| AS-07 | **App Privacy (étiquettes)**, y compris les partenaires tiers (S18). Brouillon corrigé en §5.1 | brouillon `02` l. 103 erroné (A9) | **incomplet** |
| AS-08 | 5.1.1(ii) : consentement pour collecter des données d'utilisation ou utilisateur, « même anonymes » ; libellés de permission clairs | ID envoyé au premier lancement sans écran d'information ; `address_views` automatique (`AddressDetailModal.tsx:121-132`) ; libellés de permission clairs (`app.json:16, 62, 70`) | **incomplet** (risque de remarque en révision) |
| AS-09 | 5.1.1(iii)/(iv) : minimisation, alternative en cas de refus de la localisation, sélecteur de photos | refus géré (`MapView.tsx:705-740`) ; photos réservées au portail admin ; sélecteur système via `expo-image-picker` | **conforme** |
| AS-10 | 5.1.1(v) : suppression de compte si création de compte ; comptes « invité » automatiques inclus (S16) | pas de compte ; suppression in-app facile à trouver (Accueil → Politique → « Effacer mes données ») ; la version 007 de `delete_my_data` efface aussi les jetons | **conforme** (par précaution) ; test sur appareil **non fait** |
| AS-11 | 5.1.2(i) : consentement avant de partager des données avec des tiers ; suivi interdit sans ATT ; ne pas imposer push/localisation | aucun SDK de suivi ; `NSPrivacyTracking` faux dans les manifestes lus (S29) ; Mapbox reçoit la position à la demande de l'utilisateur | **conforme** sous réserve de la déclaration Mapbox (AS-07) |
| AS-12 | 5.1.5 : consentement et finalité de la localisation | chaîne d'usage explicite (`app.json:16, 70`) ; chaînes `NSLocationAlways…` ajoutées par le plugin sans arrière-plan | **conforme** ; chaînes superflues à surveiller |
| AS-13 | 4.5.4 : push facultative, pas d'information sensible, opt-in explicite et désactivation in-app pour les push promotionnelles | interrupteur, désactivé par défaut, contenu sans donnée personnelle (`007:259`) | **conforme** sous réserve du caractère « promotionnel » (J-15) |
| AS-14 | 1.4.3 : pas d'incitation à une consommation excessive d'alcool | guide d'adresses ; à vérifier sur les textes des fiches et des annonces | **à valider** |
| AS-15 | 1.2 contenus utilisateurs : filtrage, signalement, blocage, contact | les suggestions ne sont pas diffusées à d'autres utilisateurs | **non applicable** (à rouvrir si des avis sont publiés) |
| AS-16 | Fonctions cachées/non documentées (la page lue la range sous 2.5.19 selon l'extraction ; numérotation à reconfirmer) : le **portail admin accessible par 7 appuis** sur le logo (S-19) | présent dans le binaire public | **risque** : mentionner l'espace équipe dans les Notes pour la révision, **sans fournir le code** ; ou retirer l'accès du build public |
| AS-17 | 2.1(a) : build final, métadonnées complètes, URL fonctionnelles, **aucun contenu provisoire** ; tests sur appareil | placeholders dans les pages légales ; événement de test en production (`04` N-12) ; notification jamais reçue sur un appareil (`04` §5) ; Expo Go planté (`01` l. 16) | **non conforme** à ce jour |
| AS-18 | Manifeste de confidentialité (`PrivacyInfo.xcprivacy`) et « API à raison requise » : envoi refusé si une raison manque, avec message ITMS-91053 selon la doc d'Expo (S14) | pas de `ios.privacyManifests` dans `app.json` ; plusieurs bibliothèques fournissent leur manifeste (RN, `expo-notifications` UserDefaults CA92.1, `react-native-maps` position précise + FileTimestamp C617.1, `expo-file-system`, `expo-constants`, `expo-device`, `expo-application`, `expo-system-ui`) (S29) | **impossible à vérifier** avant un build envoyé à TestFlight ; ajouter les raisons éventuelles signalées par l'e-mail d'Apple |
| AS-19 | Conformité à l'export (chiffrement) : `ITSAppUsesNonExemptEncryption: false` | `app.json:17` ; HTTPS uniquement | **impossible à vérifier** (page Apple sur l'export non lue) |
| AS-20 | Notifications push : clé APNs EAS ; entitlement `aps-environment` « production » pour le profil de production | `app.config.js:28-32` (mode production si `EAS_BUILD_PROFILE=production`) | **conforme** (configuration) ; réception réelle **non prouvée** |
| AS-21 | Captures iPad (puisque `supportsTablet: true`) ; description fidèle (2.3.x) | `app.json:13` | **à faire** |
| AS-22 | Notes pour la révision : aucune connexion nécessaire ; expliquer position, push, absence de compte ; ne pas donner le code admin | `02` §6 | **à faire** |

### 5.1 Étiquettes de confidentialité Apple — brouillon corrigé (à valider)

Définitions Apple (S18) : « collecter » = transmettre hors de l'appareil de façon accessible plus longtemps que le service en temps réel ; « lié à l'utilisateur » = rattaché à son identité **via compte, appareil ou autres détails** ; « suivi » = croisement avec des données tierces à des fins publicitaires ou courtage (non applicable ici).

| Type Apple | Donnée | Finalité | Lié ? | Suivi ? |
|---|---|---|---|---|
| **Identifiants → ID de l'appareil** | D1 (UUID applicatif) et jeton de notification D7 | Fonctionnalités de l'app | **Oui (lié)** | Non |
| **Données d'utilisation → Interaction avec le produit** | adresses découvertes, cartes utilisées, likes | Fonctionnalités de l'app | **Oui (lié)** | Non |
| Données d'utilisation → Interaction avec le produit | consultations de fiches (`address_views`, sans ID) | Analytique interne | Non lié (IP techniquement journalisée : à trancher) | Non |
| **Contenu utilisateur → Autre contenu** | suggestions | Fonctionnalités de l'app | **Oui (lié)** | Non |
| **Localisation → Position précise** | position envoyée à Mapbox pour l'itinéraire | Fonctionnalités de l'app | à décider : non lié si Mapbox ne la rattache à rien ; **dépend de la rétention par Mapbox** (extrait T2 : usage de données de localisation anonymisées pour améliorer ses produits) | Non |

Les manifestes de `react-native-maps` déclarent déjà la position précise comme collectée, non liée, non suivie (`node_modules/react-native-maps/ios/PrivacyInfo.xcprivacy`).

---

## 6. Checklist Play Store (Google)

Source : S21-S28 sauf mention.

| # | Exigence | État constaté | Statut |
|---|---|---|---|
| PS-01 | Compte Play Console : vérification d'identité ; **organisation** = D-U-N-S (sauf organisme public connu), pièce d'identité du titulaire, document officiel de l'organisation, **site web vérifié**, **téléphone et e-mail publics** (S28) | à créer (`02` §0) | **à faire** ; **impossible à vérifier** |
| PS-02 | **Test fermé obligatoire pour les comptes personnels créés après le 13/11/2023** : au moins **12 testeurs** inscrits **14 jours consécutifs**, puis demande d'accès à la production (réponse sous ~7 jours) (S21). Les comptes **organisation** ne sont pas mentionnés sur la page lue | omis dans `02` (A12) | **à faire** si compte personnel ; **impossible à vérifier** pour un compte organisation |
| PS-03 | **Niveau d'API cible** : API 36 (Android 16) pour les nouvelles applis et mises à jour depuis le 31/08/2026 ; extension possible jusqu'au 1/11/2026 pour les applis existantes (S22) | `targetSdk = 36` dans le modèle RN 0.86 (S29) ; pas de surcharge | **conforme** (dépôt) ; **impossible à vérifier** sur l'AAB |
| PS-04 | **Section Sécurité des données** obligatoire pour toute appli (même sans collecte), cohérente avec la politique, SDK compris ; les ID pseudonymes sont à déclarer ; la position déduite de l'IP aussi (S24, S25) | brouillon `02` l. 104 | **incomplet** (voir §6.1) |
| PS-05 | **Politique de confidentialité** : lien dans la console **et** dans l'appli ; contenu : données, destinataires, sécurité, **conservation et suppression**, contact ; page publique, non modifiable, **pas un PDF** (S25) | modale OK ; pages HTML non hébergées, placeholders | **non conforme** tant que non hébergée/complétée |
| PS-06 | **Questions de suppression de données** de la section Sécurité (toutes les applis) ; suppression de compte in-app + lien web **seulement pour les applis qui permettent la création de compte** (S23) | pas de compte ; bouton in-app et page `public/suppression-donnees.html` existent | **conforme** ; corriger le paragraphe « désinstallé » (A4) |
| PS-07 | **Permissions** : localisation au premier plan seulement ; le formulaire de déclaration vise l'arrière-plan (S26) ; `POST_NOTIFICATIONS` et `RECEIVE_BOOT_COMPLETED` ajoutées par `expo-notifications` (S29) | `app.json:29-32` ; arrière-plan désactivé (`app.json:72-74`) ; image-picker bloqué (caméra, stockage) | **conforme** (dépôt) ; manifeste fusionné **impossible à vérifier** sans build |
| PS-08 | Divulgation en évidence + consentement préalable quand l'usage de données est inattendu (arrière-plan, etc.) (S25) | aucun usage inattendu identifié ; position au premier plan | **conforme** (réserve : envoi de la position à Mapbox, J-16) |
| PS-09 | Données des **SDK** : FCM et Firebase Installations (identifiant d'installation Firebase, user-agent) à déclarer (S27) ; Google Maps SDK pour Android et Mapbox à vérifier dans l'index des SDK | non consulté | **incomplet** |
| PS-10 | Notifications : canal créé avant la demande de permission (Android 13+) (S12) | `pushNotifications.ts:43-48` | **conforme** |
| PS-11 | FCM V1 : `google-services.json` + clé de compte de service dans EAS ; clé Google Maps restreinte | garde-fou `app.config.js:14-25` ; `04` N-04 (configurés, non prouvés) | **conforme** (config) ; réception **non prouvée** |
| PS-12 | **Statut de trader (DSA)** pour la fiche Play dans l'UE | page Google non localisée | **impossible à vérifier** |
| PS-13 | Questionnaire de classification (IARC) ; déclaration « contient des publicités » | non consultés ; sections partenaires sponsorisés + alcool (J-18/J-19) | **à faire** |
| PS-14 | Coordonnées publiques du développeur (e-mail, téléphone pour les organisations) et à jour ; faute de quoi, retrait possible (S28) | `contact@lepetittou.net` | **à faire** (téléphone) |
| PS-15 | Publication : vérifications des développeurs Android (sideloading) prévues dans 4 pays dès le 30/09/2026, mondial en 2027 (T9, presse) | hors France en 2026 | **non applicable** (information) |

### 6.1 Section Sécurité des données — brouillon corrigé (à valider)

Termes Google (S24) : « collecter » = envoyer hors de l'appareil, SDK compris ; « partager » = transférer à un tiers, sauf prestataires agissant sur instruction ; traitement éphémère exempté de l'affichage mais à déclarer.

| Catégorie Google | Collectée ? | Partagée ? | Finalité | Optionnelle ? |
|---|---|---|---|---|
| Identifiants de l'appareil ou autres | **Oui** (UUID applicatif, jeton de notification, identifiant d'installation Firebase) | Non (Supabase/Expo/Firebase = prestataires) — à valider | Fonctionnalités de l'appli, communications | ID : requis pour les fonctions ; jeton : optionnel |
| Activité dans l'appli (interactions) | Oui (découvertes, cartes, likes ; consultations) | Non | Fonctionnalités | Oui pour la plupart |
| Contenu généré (autre) | Oui (suggestions) | Non | Fonctionnalités | Oui |
| Position approximative / précise | **Oui** si la position part chez Mapbox (itinéraire) ; exemption « traitement éphémère » possible mais **non établie** | à qualifier (Mapbox = prestataire) | Fonctionnalités | Oui |
| Chiffrement en transit | Oui (HTTPS) | — | — | — |
| Suppression à la demande | Oui : bouton in-app + page web | — | — | — |

---

## 7. Questions précises au responsable du traitement (l'association)

À renseigner avant la soumission ; chaque réponse alimente le registre (J-08) et les fiches des boutiques.

**Identité et organisation**
1. Q-01 — Quel est le numéro RNA et/ou SIREN, et qui est le directeur ou la directrice de la publication (nom, qualité) ? (`mentions-legales.html:20, 22`)
2. Q-02 — L'association dispose-t-elle d'un numéro D-U-N-S ? Les comptes Apple/Google seront-ils au nom de l'association (organisation) ou d'une personne physique (ce qui déclenche, côté Google, le test fermé de 12 testeurs pendant 14 jours) ?
3. Q-03 — Quel numéro de téléphone professionnel peut être publié sur les fiches (Google l'impose aux organisations ; Apple l'affiche pour les traders) ?
4. Q-04 — Y a-t-il un délégué ou référent à la protection des données ? Qui répond aux demandes de droits et dans quel délai ?

**Hébergement, contrats, transferts**
5. Q-05 — Quelle est la **région** du projet Supabase (Settings → General) ? Le DPA Supabase a-t-il été accepté dans le compte et archivé ?
6. Q-06 — Quel plan Supabase est utilisé (sauvegarde, rétention des journaux d'API) ? Les journaux d'API couvrant la période d'exposition avant 006 existent-ils encore ?
7. Q-07 — Qui héberge les pages `public/` (domaine `lepetittou.net` ?) et la version web de l'appli : est-elle publiée ? Si oui, où ?
8. Q-08 — Expo a-t-il fourni ou accepté un DPA pour le service de notifications ? Les « sécurités renforcées » des notifications (jeton d'accès EAS) peuvent-elles être activées ?

**Qualification de l'incident (urgent)**
9. Q-09 — À quelle date l'association (et non seulement l'auditeur) a-t-elle eu connaissance de l'exposition de la base ? Quelqu'un a-t-il examiné les journaux pour y chercher des lectures/écritures anormales ? Une analyse écrite « violation / pas de violation » existe-t-elle ?

**Finalités et contenus**
10. Q-10 — Les notifications « Agenda des partenaires » et les annonces libres peuvent-elles promouvoir des partenaires **payants** ? Qui rédige les annonces et suivant quelles règles ?
11. Q-11 — Les partenaires de `sponsored_partners` paient-ils un montant (`price_paid`) ? Si oui, souhaitez-vous afficher « Contenu sponsorisé/Publicité » au lieu de « OFFICIEL » ?
12. Q-12 — Parmi les partenaires et adresses, quelle part concerne des boissons alcooliques (bars, caves) ? Des annonces vantent-elles ces boissons ?
13. Q-13 — L'application s'adresse-t-elle aussi aux moins de 15 ans ? Quelle classe d'âge visez-vous ?
14. Q-14 — L'association perçoit-elle des recettes liées à l'appli (partenariats payants, commissions) ? C'est l'un des critères d'Apple pour le statut de **trader** (S20) : quel statut déclarez-vous ?
15. Q-15 — Acceptez-vous que l'adresse issue du D-U-N-S, l'e-mail et le téléphone soient publiés sur la fiche App Store dans l'UE ?

**Données et durées**
16. Q-16 — Durée de conservation voulue pour les **suggestions** (aujourd'hui : illimitée), pour les jetons de notification inactifs (aujourd'hui 270 jours), pour les consultations (13 mois), pour l'inactivité (24 mois) ? Ces durées vous conviennent-elles ?
17. Q-17 — Les suggestions sont-elles lues et traitées ? Par qui et à quel rythme (pour les purger après traitement) ?
18. Q-18 — Acceptez-vous de ne créer l'identifiant d'appareil qu'à la première action de l'utilisateur (au lieu du premier lancement) ? Souhaitez-vous un écran d'information au premier lancement ?
19. Q-19 — Souhaitez-vous afficher l'identifiant dans l'écran de confidentialité et proposer un export JSON (accès/portabilité) ?
20. Q-20 — La version iOS doit-elle conserver l'identifiant après réinstallation (comportement actuel du Keychain) ? C'est utile pour les quotas de cartes, mais doit être expliqué.

**Boutiques**
21. Q-21 — Qui est le compte propriétaire Expo (`owner: ryadhhshshhs` dans `app.json`) ? Le compte appartient-il à l'association ou à une personne ?
22. Q-22 — Le portail admin doit-il rester dans l'appli publique (7 appuis sur le logo) ? Sinon, le retirer du build public réduit le risque de rejet Apple et la surface d'attaque.
23. Q-23 — Souhaitez-vous distribuer l'application sur iPad (`supportsTablet: true`) ? Si non, passer à `false` évite les captures iPad.
24. Q-24 — La billetterie « partenaire » (redirection depuis l'accueil) est-elle un service de l'association (commerce électronique) ou une simple redirection ?

---

## 8. Corrections à apporter au code ou aux pages légales

Ordre de priorité décroissante. Aucune n'a été appliquée.

| # | Fichier(s) | Correction | Lié à |
|---|---|---|---|
| C-1 | `public/mentions-legales.html:20, 22, 24, 25` ; `public/confidentialite.html:41, 44` | Remplacer les 5 placeholders ; supprimer la classe `.todo` ; héberger les 3 pages en HTML public ; reporter les URL dans les consoles | J-04, J-20, AS-05, PS-05 |
| C-2 | `src/components/PrivacyPolicyModal.tsx` (l. 101-216) et `public/confidentialite.html` | Aligner les deux textes ; ajouter région d'hébergement, mécanisme de transfert **par destinataire**, Firebase/FCM, durées réelles (jetons 270 j, suggestions), base légale de la position/itinéraire, IP dans les journaux des hébergeurs, absence de rectification des totaux de likes ; mettre à jour la date | J-02, J-03, J-04, J-13 |
| C-3 | `src/components/NotificationSettingsModal.tsx:114`, `PrivacyPolicyModal.tsx:161`, `public/confidentialite.html` §3, `src/scripts/007_push_notifications.sql:399` | Rendre la promesse « au plus 2 par jour, jamais la nuit » vraie : soit compter les annonces dans le plafond, soit modifier le texte ; vérifier les heures calmes aussi dans `push_send` (`007:416-455`) | J-15, A17 |
| C-4 | `src/scripts/007_push_notifications.sql:736-787` | Ajouter `place_suggestions` à la purge ; compter suggestions et jetons dans l'« activité » ; documenter les durées | J-02, A18 |
| C-5 | `src/scripts/007_push_notifications.sql:443-446, 600-603` | Ajouter l'en-tête `Authorization: Bearer <jeton d'accès EAS>` (secret dans Supabase Vault) après activation de la sécurité renforcée | J-09 |
| C-6 | `src/lib/deviceIdentity.ts`, `src/lib/authService.ts`, `src/lib/discoveryStore.ts:33-40, 78-85`, `src/lib/discountCardsStore.ts:121-129`, `src/lib/likesStore.ts` | Ne créer l'ID et ne rien envoyer au serveur avant une action explicite ; sinon, ajouter un écran d'information au premier lancement | J-06, J-14, AS-08 |
| C-7 | `src/components/PrivacyPolicyModal.tsx` + fonction serveur de lecture | Afficher « Mon identifiant », ajouter un export des données ; écrire la procédure d'exercice des droits (réponse sous un mois, application de l'art. 11) | J-05 |
| C-8 | `public/suppression-donnees.html:24-26` | Corriger « Si vous avez désinstallé l'application » : sur iOS l'identifiant peut survivre à la réinstallation (le bouton in-app fonctionnera) ; sur Android il est perdu et les données restantes sont supprimées après 24 mois d'inactivité ; ajouter le délai de réponse pour les demandes par e-mail | A4, PS-06 |
| C-9 | `src/components/views/HomeView.tsx:1663-1665` | Remplacer « Top Partenaires » + « OFFICIEL » par un libellé de contenu sponsorisé, après validation juridique | J-18 |
| C-10 | `package.json:42` | Supprimer l'entrée `"undefined": "/private/tmp/claude-501/npmcache"` ; relancer `npm install` pour régénérer `package-lock.json` | A19 (build) |
| C-11 | `src/components/views/MapView.tsx:675` | Évaluer `Location.Accuracy.Balanced` pour le centrage/les distances ; garder `High` seulement pour l'itinéraire ; information « votre position est envoyée à Mapbox » au moment de l'itinéraire | J-16 |
| C-12 | `app.json` (plugin `expo-location`, l. 67-75) et sortie de `prebuild` | Vérifier la présence de `NSLocationAlways…` ; les retirer si la configuration le permet | AS-12 |
| C-13 | `app.json` (`ios`) | Ajouter `ios.privacyManifests` seulement si Apple signale des raisons manquantes (S14) ; décider `supportsTablet` | AS-18, AS-21 |
| C-14 | `src/components/views/map/mapboxHtmlTemplate.ts:19` | (Web) Auto-héberger `supercluster` ; vérifier la télémétrie Mapbox GL | J-27 |
| C-15 | Documents d'audit : `01-RAPPORT-AUDIT-2026-10-19.md` (l. 51, 88, 91, 115, 116, 117, 174, 182), `02-PUBLICATION.md` (l. 103-104, 118, §0), `04-SUIVI-2026-10-21.md` (N-08) | Reporter les corrections de la section 2 de ce rapport | A1-A16 |
| C-16 | Hors dépôt | Créer le registre (J-08), l'analyse « violation » (J-10), l'analyse d'exemption art. 82 (J-14), les contrats archivés (J-07, J-13) | J-07 à J-14 |
| C-17 | `src/scripts/006_security_lockdown.sql:750` | Corriger le commentaire périmé | A16 |

---

## 9. Ce qui est vérifié, ce qui ne l'est pas

**Vérifié aujourd'hui (lecture directe)** : contenu des fichiers du dépôt cités ; manifestes de confidentialité et d'autorisations des bibliothèques installées ; niveau d'API cible du modèle React Native ; textes des pages Apple et Google listées en S15-S28 (sauf parties tronquées) ; recommandation CNIL sur les applications mobiles (PDF) ; lignes directrices EDPB 2/2023 ; DPA Supabase ; politique Expo ; documentation Expo.

**Non vérifié** : texte officiel du RGPD, de la directive ePrivacy, du DSA, de l'EAA, du règlement IA et de NIS 2 (EUR-Lex bloqué) ; articles de Légifrance (82 et 45 de la loi 78-17, L. 34-5 CPCE, LCEN 6 et 20, L. 3323-2 CSP, art. 47 de la loi 2005) ; pages HTML de la CNIL (503) ; DPA Mapbox, Firebase, Expo ; certification DPF d'Expo et Mapbox ; page Google sur le statut de trader ; questionnaire IARC ; manifeste Android fusionné ; état de production (hors `04`) ; fonctionnement sur un appareil réel.

**À faire valider par un humain compétent** : qualification d'une violation (J-10, délai) ; bases légales (J-03) ; exemption art. 82 (J-14) ; statut de trader (AS-02) ; contenu promotionnel et loi Evin (J-18, J-19) ; classe d'âge ; applicabilité DSA/NIS 2/accessibilité ; rédaction finale des pages légales.
