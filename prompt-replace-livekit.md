# 🎯 PROMPT — Remplacement complet de LiveKit par WebRTC natif + Supabase Realtime

## Contexte du projet
Tu travailles sur un **clone de Discord** full-stack. Le projet utilise :
- **Frontend** : React (ou Next.js), déployé sur **Vercel**
- **Backend / Base de données** : **Supabase** (Auth, Database, Realtime)
- **Fonctionnalités vocales/vidéo actuelles** : LiveKit (à remplacer entièrement)

---

## Objectif
**Remplacer 100% du code LiveKit** par une solution **entièrement gratuite, sans VPS, sans serveur externe**, qui fonctionne nativement avec la stack Supabase + Vercel :

> **Solution cible : WebRTC natif (browser API) + Supabase Realtime comme serveur de signaling**

- `RTCPeerConnection` → gère l'audio/vidéo peer-to-peer directement dans le navigateur
- `Supabase Realtime (Broadcast)` → remplace le serveur LiveKit pour l'échange des signaux WebRTC (SDP offers/answers + ICE candidates)
- `getUserMedia()` → capture le micro / la caméra
- Aucun service tiers payant, aucun VPS nécessaire

---

## Ce que tu dois faire — étape par étape

### 1. Supprimer LiveKit
- Désinstalle les packages LiveKit : `@livekit/components-react`, `livekit-client`, `livekit-server-sdk` (et tout package `livekit-*`)
- Supprime toutes les variables d'environnement LiveKit (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, etc.)
- Supprime toutes les routes API qui généraient des tokens LiveKit

### 2. Créer le service de signaling avec Supabase Realtime
Crée un fichier `lib/webrtc/signaling.ts` (ou `.js`) qui utilise **Supabase Realtime Broadcast** pour échanger les messages WebRTC entre pairs.

Le canal Supabase doit être nommé dynamiquement par salon vocal : `voice-channel-{channelId}`.

Les types de messages à broadcaster :
```ts
type SignalMessage =
  | { type: 'offer';     fromUserId: string; toUserId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer';    fromUserId: string; toUserId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice';       fromUserId: string; toUserId: string; candidate: RTCIceCandidateInit }
  | { type: 'join';      fromUserId: string; userName: string }
  | { type: 'leave';     fromUserId: string }
```

### 3. Créer le hook principal `useVoiceChannel`
Crée `hooks/useVoiceChannel.ts` qui expose exactement la même interface que l'ancien hook LiveKit, mais propulsé par WebRTC natif :

```ts
const {
  localAudioTrack,       // MediaStreamTrack du micro local
  remoteParticipants,    // Map<userId, { stream: MediaStream, userName: string, isMuted: boolean }>
  isMuted,               // boolean
  isDeafened,            // boolean
  isConnected,           // boolean
  isConnecting,          // boolean
  joinChannel,           // (channelId: string) => Promise<void>
  leaveChannel,          // () => void
  toggleMute,            // () => void
  toggleDeafen,          // () => void
} = useVoiceChannel();
```

Logique interne du hook :
1. `joinChannel(channelId)` :
   - Appelle `getUserMedia({ audio: true, video: false })`
   - S'abonne au canal Supabase Realtime `voice-channel-{channelId}`
   - Broadcast un message `join` avec l'userId et le userName de l'utilisateur connecté (depuis `supabase.auth.getUser()`)
   - Pour chaque participant déjà présent (qui répond au `join`), crée une `RTCPeerConnection` et envoie un `offer`

2. Gestion des messages entrants :
   - `join` → créer une `RTCPeerConnection` pour ce nouvel arrivant, envoyer un `offer`
   - `offer` → créer une `RTCPeerConnection`, appliquer l'offre SDP, envoyer un `answer`
   - `answer` → appliquer la réponse SDP à la connexion correspondante
   - `ice` → ajouter le candidat ICE à la connexion correspondante
   - `leave` → fermer et supprimer la connexion du participant

3. Chaque `RTCPeerConnection` doit :
   - Utiliser ces serveurs STUN gratuits (Google) :
     ```ts
     iceServers: [
       { urls: 'stun:stun.l.google.com:19302' },
       { urls: 'stun:stun1.l.google.com:19302' },
     ]
     ```
   - Ajouter le track audio local avec `pc.addTrack(localAudioTrack, localStream)`
   - Sur `ontrack` : ajouter le stream distant dans `remoteParticipants`
   - Sur `onicecandidate` : broadcaster le candidat ICE via Supabase

4. `leaveChannel()` :
   - Broadcast `leave`
   - Fermer toutes les `RTCPeerConnection`
   - Stopper tous les tracks locaux (`track.stop()`)
   - Se désabonner du canal Supabase

5. `toggleMute()` : active/désactive `localAudioTrack.enabled`
6. `toggleDeafen()` : met le volume de tous les streams distants à 0 / 1

### 4. Remplacer les composants LiveKit dans l'UI
Recherche dans tout le projet tous les composants et imports LiveKit et remplace-les :

| Ancien (LiveKit) | Nouveau (WebRTC natif) |
|---|---|
| `<LiveKitRoom>` | Utilise `useVoiceChannel()` directement, pas de wrapper |
| `<AudioTrack>` | `<audio ref={r => r && (r.srcObject = stream)} autoPlay />` |
| `<ParticipantTile>` | Crée un composant `<VoiceParticipant>` en utilisant `remoteParticipants` |
| `<ControlBar>` | Utilise `toggleMute`, `toggleDeafen`, `leaveChannel` du hook |
| `useLocalParticipant()` | Remplace par les valeurs de `useVoiceChannel()` |
| `useParticipants()` | Remplace par `remoteParticipants` de `useVoiceChannel()` |
| `useRoomContext()` | Supprime, remplace par `useVoiceChannel()` |
| Token LiveKit (route API) | Supprime entièrement cette route |

### 5. Vérifications finales
- [ ] Aucun import `livekit` ne subsiste dans le projet (`grep -r "livekit" src/`)
- [ ] Les variables d'environnement LiveKit sont retirées de `.env.local` et de Vercel
- [ ] `getUserMedia` est appelé uniquement après une action utilisateur (clic sur "Rejoindre le salon") pour respecter les politiques navigateur
- [ ] La déconnexion est propre : tracks stoppés, canaux Supabase fermés, `RTCPeerConnection` fermées
- [ ] Les erreurs `getUserMedia` (micro refusé) sont gérées avec un message clair à l'utilisateur

---

## Contraintes importantes à respecter
- **Ne jamais utiliser de serveur custom** : tout passe par Supabase Realtime, pas de WebSocket custom, pas de serveur Express séparé
- **Compatible Vercel** : aucun code serveur persistant (pas de `setInterval` côté serveur, pas de WebSocket server)
- **100% gratuit** : uniquement les APIs navigateur natives (`RTCPeerConnection`, `getUserMedia`) + Supabase Realtime déjà en place
- **TypeScript strict** : types complets sur tous les messages de signaling et le hook

---

## Notes sur les limitations à documenter dans le code
Ajoute un commentaire en haut de `hooks/useVoiceChannel.ts` :
```ts
/**
 * useVoiceChannel — WebRTC P2P via Supabase Realtime Signaling
 *
 * Architecture : mesh P2P (chaque pair se connecte à chaque autre pair)
 * Optimal pour : 2 à ~6 utilisateurs simultanés dans un salon
 * Au-delà de 6 : prévoir un SFU (ex: LiveKit self-hosted ou Mediasoup)
 * Signaling : Supabase Realtime Broadcast (gratuit, sans VPS)
 * STUN : serveurs Google (gratuits, sans inscription)
 */
```
