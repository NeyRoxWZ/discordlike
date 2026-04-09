# DISTOLLEC — Prompt Complet pour TRAE
> Clone fonctionnel et visuel de Discord, nommé **Distollec**, déployé sur Vercel, 100% gratuit.

---

## 0. CONSIGNE GÉNÉRALE POUR TRAE

Tu vas construire une application web nommée **Distollec** de A à Z. Il s'agit d'un clone fonctionnel et visuel de Discord. Tout doit fonctionner : messagerie en temps réel, salons vocaux (WebRTC), rôles, permissions, serveurs, DMs, amis, profils, paramètres, webhooks, invitations, emojis custom, autocollants. Aucune fonctionnalité ne doit être simulée ou laissée en état de placeholder — tout doit être câblé et opérationnel.

Lis ce document en entier avant d'écrire la moindre ligne de code. Respecte chaque contrainte. Ne saute aucune section.

---

## 1. STACK TECHNIQUE OBLIGATOIRE

### Frontend
- **Framework** : Next.js 14 (App Router, `app/` directory)
- **Language** : TypeScript strict (`"strict": true` dans tsconfig)
- **Styling** : Tailwind CSS v3 + CSS Modules pour les cas complexes
- **Icons** : **Phosphor Icons** (`@phosphor-icons/react`) — pack peu commun, beau, cohérent, 6 variantes (Regular, Bold, Fill, Duotone, Light, Thin). N'utilise PAS Heroicons, FontAwesome, ou Lucide.
- **Animations** : Framer Motion
- **State management** : Zustand (stores globaux) + TanStack Query (server state / cache)
- **Forms** : React Hook Form + Zod validation
- **Rich text editor** (messages) : Slate.js ou TipTap
- **Drag & Drop** (réorganisation de salons/serveurs) : @dnd-kit/core

### Backend
- **API** : Next.js API Routes (dans `app/api/`) pour le REST
- **Real-time** : **Supabase Realtime** (canaux, présence, broadcast) — WebSockets managés gratuits
- **Voix** : **LiveKit Cloud** (free tier 25 GB/mois) via `livekit-client` côté front et `livekit-server-sdk` côté back pour générer des tokens JWT

### Base de données & Auth
- **Base de données** : **Supabase** (PostgreSQL managé, free tier : 500 MB, 2 projets)
  - URL Supabase + Anon Key dans les env vars
  - Utilise le client `@supabase/supabase-js` v2
- **Auth** : Supabase Auth (email/password + OAuth Google/GitHub optionnel)
- **ORM** : **Prisma** avec le provider `postgresql` pointant sur la DB Supabase

### Stockage fichiers
- **Supabase Storage** (free : 1 GB) pour : avatars, bannières de profil, emojis custom, autocollants custom, pièces jointes

### Déploiement
- **Vercel** (free tier) pour le front + les API Routes Next.js
- Variables d'environnement dans le dashboard Vercel

---

## 2. STRUCTURE DU PROJET

```
distollec/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (app)/
│   │   ├── layout.tsx                  # Layout principal avec sidebar gauche
│   │   ├── channels/
│   │   │   └── @me/                   # DMs & amis
│   │   │       ├── page.tsx
│   │   │       └── [conversationId]/page.tsx
│   │   └── servers/
│   │       └── [serverId]/
│   │           ├── layout.tsx
│   │           └── [channelId]/page.tsx
│   ├── api/
│   │   ├── auth/[...supabase]/route.ts
│   │   ├── servers/route.ts
│   │   ├── servers/[serverId]/route.ts
│   │   ├── servers/[serverId]/channels/route.ts
│   │   ├── servers/[serverId]/members/route.ts
│   │   ├── servers/[serverId]/roles/route.ts
│   │   ├── servers/[serverId]/bans/route.ts
│   │   ├── servers/[serverId]/invites/route.ts
│   │   ├── servers/[serverId]/webhooks/route.ts
│   │   ├── servers/[serverId]/emojis/route.ts
│   │   ├── servers/[serverId]/stickers/route.ts
│   │   ├── messages/route.ts
│   │   ├── messages/[messageId]/route.ts
│   │   ├── friends/route.ts
│   │   ├── users/me/route.ts
│   │   ├── users/[userId]/route.ts
│   │   ├── voice/token/route.ts        # LiveKit JWT token
│   │   └── upload/route.ts
│   └── layout.tsx                      # Root layout
├── components/
│   ├── auth/
│   ├── sidebar/
│   │   ├── ServerList.tsx
│   │   ├── ServerListItem.tsx
│   │   ├── DirectMessageList.tsx
│   │   └── ChannelList.tsx
│   ├── channels/
│   │   ├── TextChannel.tsx
│   │   ├── VoiceChannel.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   ├── MessageItem.tsx
│   │   └── TypingIndicator.tsx
│   ├── voice/
│   │   ├── VoiceRoom.tsx
│   │   ├── ParticipantTile.tsx
│   │   └── VoiceControls.tsx
│   ├── modals/
│   │   ├── CreateServerModal.tsx
│   │   ├── EditServerModal.tsx
│   │   ├── CreateChannelModal.tsx
│   │   ├── InviteModal.tsx
│   │   ├── BanModal.tsx
│   │   └── UserProfileModal.tsx
│   ├── settings/
│   │   ├── UserSettings.tsx
│   │   ├── ServerSettings.tsx
│   │   └── tabs/
│   ├── ui/
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Tooltip.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   └── profile/
│       ├── UserProfileCard.tsx
│       └── ProfileCustomizer.tsx
├── hooks/
│   ├── useSupabaseRealtime.ts
│   ├── useMessages.ts
│   ├── useVoiceChannel.ts
│   ├── useTypingIndicator.ts
│   ├── usePresence.ts
│   └── useMemberPermissions.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── livekit.ts
│   ├── permissions.ts                  # Système de permissions bitfield
│   ├── prisma.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── store/
│   ├── useUserStore.ts
│   ├── useServerStore.ts
│   ├── useUIStore.ts
│   └── useVoiceStore.ts
├── types/
│   └── index.ts
├── public/
│   └── sounds/                        # Sons Discord-like (join, leave, notif)
├── styles/
│   └── globals.css
├── middleware.ts                       # Protection des routes auth
├── tailwind.config.ts
├── next.config.ts
└── .env.local
```

---

## 3. SCHÉMA DE BASE DE DONNÉES (Prisma complet)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── UTILISATEURS ────────────────────────────────────────────────────────────

model User {
  id                String    @id @default(cuid())
  supabaseId        String    @unique  // ID Supabase Auth
  username          String    @unique  // ex: shadow_wolf
  discriminator     String    @default("0000") // 4 chiffres
  displayName       String?
  email             String    @unique
  avatarUrl         String?
  bannerUrl         String?
  profileColor      String?   @default("#5865F2")   // couleur dominante profil
  profileEffect     String?   // ID d'un effet (ex: "confetti", "snow", "fire")
  bio               String?   @db.VarChar(190)
  pronouns          String?
  status            UserStatus @default(ONLINE)
  customStatus      String?
  statusEmoji       String?
  isBot             Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relations
  members           Member[]
  messages          Message[]
  sentFriendReqs    FriendRequest[]  @relation("sender")
  receivedFriendReqs FriendRequest[] @relation("receiver")
  friends           Friendship[]     @relation("userFriends")
  friendOf          Friendship[]     @relation("friendOf")
  dmParticipants    DMParticipant[]
  ownedServers      Server[]
  blockedUsers      BlockedUser[]    @relation("blocker")
  blockedBy         BlockedUser[]    @relation("blocked")
  voiceSessions     VoiceSession[]
  reactions         MessageReaction[]
  notes             UserNote[]       @relation("noter")
  notedBy           UserNote[]       @relation("noted")
}

enum UserStatus {
  ONLINE
  IDLE
  DO_NOT_DISTURB
  INVISIBLE
  OFFLINE
}

// ─── AMIS ────────────────────────────────────────────────────────────────────

model FriendRequest {
  id         String   @id @default(cuid())
  senderId   String
  receiverId String
  status     FriendRequestStatus @default(PENDING)
  createdAt  DateTime @default(now())
  sender     User     @relation("sender", fields: [senderId], references: [id], onDelete: Cascade)
  receiver   User     @relation("receiver", fields: [receiverId], references: [id], onDelete: Cascade)

  @@unique([senderId, receiverId])
}

enum FriendRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}

model Friendship {
  id        String   @id @default(cuid())
  userId    String
  friendId  String
  createdAt DateTime @default(now())
  user      User     @relation("userFriends", fields: [userId], references: [id], onDelete: Cascade)
  friend    User     @relation("friendOf", fields: [friendId], references: [id], onDelete: Cascade)

  @@unique([userId, friendId])
}

model BlockedUser {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  createdAt DateTime @default(now())
  blocker   User     @relation("blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   User     @relation("blocked", fields: [blockedId], references: [id], onDelete: Cascade)

  @@unique([blockerId, blockedId])
}

// ─── MESSAGES PRIVÉS ─────────────────────────────────────────────────────────

model DMConversation {
  id           String          @id @default(cuid())
  isGroupDM    Boolean         @default(false)
  groupName    String?
  groupIconUrl String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  participants DMParticipant[]
  messages     Message[]
}

model DMParticipant {
  id             String         @id @default(cuid())
  userId         String
  conversationId String
  isOwner        Boolean        @default(false)
  lastRead       DateTime?
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation   DMConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([userId, conversationId])
}

// ─── SERVEURS ────────────────────────────────────────────────────────────────

model Server {
  id              String    @id @default(cuid())
  name            String
  description     String?
  iconUrl         String?
  bannerUrl       String?
  splashUrl       String?
  ownerId         String
  isPublic        Boolean   @default(false)
  vanityUrl       String?   @unique
  verificationLevel VerificationLevel @default(NONE)
  defaultMessageNotifications NotificationLevel @default(ALL_MESSAGES)
  explicitContentFilter ExplicitContentFilter @default(DISABLED)
  systemChannelId String?
  rulesChannelId  String?
  updatesChannelId String?
  maxMembers      Int       @default(500000)
  preferredLocale String    @default("fr")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  owner           User      @relation(fields: [ownerId], references: [id])
  channels        Channel[]
  members         Member[]
  roles           Role[]
  invites         Invite[]
  emojis          CustomEmoji[]
  stickers        CustomSticker[]
  bans            Ban[]
  webhooks        Webhook[]
  categoryChannels ChannelCategory[]
  auditLogs       AuditLog[]
  scheduledEvents ScheduledEvent[]
}

enum VerificationLevel {
  NONE
  LOW
  MEDIUM
  HIGH
  VERY_HIGH
}

enum NotificationLevel {
  ALL_MESSAGES
  ONLY_MENTIONS
}

enum ExplicitContentFilter {
  DISABLED
  MEMBERS_WITHOUT_ROLES
  ALL_MEMBERS
}

// ─── CATÉGORIES DE SALONS ────────────────────────────────────────────────────

model ChannelCategory {
  id        String    @id @default(cuid())
  name      String
  position  Int       @default(0)
  serverId  String
  server    Server    @relation(fields: [serverId], references: [id], onDelete: Cascade)
  channels  Channel[]

  @@index([serverId])
}

// ─── SALONS ──────────────────────────────────────────────────────────────────

model Channel {
  id          String      @id @default(cuid())
  name        String
  type        ChannelType @default(TEXT)
  topic       String?
  position    Int         @default(0)
  isNsfw      Boolean     @default(false)
  slowMode    Int         @default(0)   // secondes entre messages
  bitrate     Int         @default(64000)  // pour vocal
  userLimit   Int         @default(0)      // pour vocal, 0 = illimité
  serverId    String?
  categoryId  String?
  isPrivate   Boolean     @default(false)
  lastMessageId String?
  createdAt   DateTime    @default(now())

  server      Server?     @relation(fields: [serverId], references: [id], onDelete: Cascade)
  category    ChannelCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  messages    Message[]
  voiceSessions VoiceSession[]
  overwrites  PermissionOverwrite[]
  webhooks    Webhook[]
  dmConversation DMConversation? // pour les DMs seulement (type DM)

  @@index([serverId])
  @@index([categoryId])
}

enum ChannelType {
  TEXT
  VOICE
  ANNOUNCEMENT
  STAGE
  FORUM
  DM
  GROUP_DM
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────

model Message {
  id              String      @id @default(cuid())
  content         String?     @db.Text
  type            MessageType @default(DEFAULT)
  authorId        String?
  channelId       String?
  dmConversationId String?
  pinned          Boolean     @default(false)
  editedAt        DateTime?
  referencedMessageId String?
  webhookId       String?
  embeds          Json?       // JSON array d'embeds
  attachments     Attachment[]
  createdAt       DateTime    @default(now())

  author          User?       @relation(fields: [authorId], references: [id], onDelete: SetNull)
  channel         Channel?    @relation(fields: [channelId], references: [id], onDelete: Cascade)
  dmConversation  DMConversation? @relation(fields: [dmConversationId], references: [id], onDelete: Cascade)
  referencedMessage Message?  @relation("replies", fields: [referencedMessageId], references: [id], onDelete: SetNull)
  replies         Message[]   @relation("replies")
  reactions       MessageReaction[]
  webhook         Webhook?    @relation(fields: [webhookId], references: [id], onDelete: SetNull)

  @@index([channelId, createdAt])
  @@index([dmConversationId, createdAt])
}

enum MessageType {
  DEFAULT
  RECIPIENT_ADD
  RECIPIENT_REMOVE
  CALL
  CHANNEL_NAME_CHANGE
  CHANNEL_ICON_CHANGE
  CHANNEL_PINNED_MESSAGE
  MEMBER_JOIN
  BOOST
  BOOST_TIER_1
  BOOST_TIER_2
  BOOST_TIER_3
  REPLY
  SLASH_COMMAND
  THREAD_CREATED
  STAGE_START
  STAGE_END
}

model Attachment {
  id          String   @id @default(cuid())
  messageId   String
  url         String
  filename    String
  size        Int
  contentType String?
  width       Int?
  height      Int?
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model MessageReaction {
  id        String   @id @default(cuid())
  messageId String
  userId    String
  emoji     String   // unicode emoji ou ID d'emoji custom
  isCustom  Boolean  @default(false)
  createdAt DateTime @default(now())
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, emoji])
}

// ─── MEMBRES ─────────────────────────────────────────────────────────────────

model Member {
  id          String    @id @default(cuid())
  userId      String
  serverId    String
  nickname    String?
  avatarUrl   String?   // avatar custom dans ce serveur
  joinedAt    DateTime  @default(now())
  timedOutUntil DateTime?
  isPending   Boolean   @default(false)

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  server      Server    @relation(fields: [serverId], references: [id], onDelete: Cascade)
  roles       MemberRole[]

  @@unique([userId, serverId])
  @@index([serverId])
}

// ─── RÔLES ───────────────────────────────────────────────────────────────────

model Role {
  id          String   @id @default(cuid())
  name        String
  color       Int      @default(0)  // couleur en decimal (0 = pas de couleur)
  hoist       Boolean  @default(false)  // afficher séparément dans la sidebar
  icon        String?  // URL icone du rôle
  unicodeEmoji String?
  position    Int      @default(0)
  permissions BigInt   @default(0)  // bitfield de permissions
  mentionable Boolean  @default(false)
  managed     Boolean  @default(false)  // géré par un bot
  isEveryone  Boolean  @default(false)  // rôle @everyone
  serverId    String
  createdAt   DateTime @default(now())

  server      Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
  memberRoles MemberRole[]
  overwrites  PermissionOverwrite[]

  @@index([serverId])
}

model MemberRole {
  memberId String
  roleId   String
  member   Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
  role     Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([memberId, roleId])
}

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────

model PermissionOverwrite {
  id        String   @id @default(cuid())
  channelId String
  type      OverwriteType  // ROLE ou MEMBER
  targetId  String   // roleId ou memberId
  allow     BigInt   @default(0)
  deny      BigInt   @default(0)
  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  role      Role?    @relation(fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([channelId, targetId, type])
}

enum OverwriteType {
  ROLE
  MEMBER
}

// ─── INVITATIONS ─────────────────────────────────────────────────────────────

model Invite {
  code        String   @id
  serverId    String
  channelId   String?
  inviterId   String?
  maxUses     Int      @default(0)  // 0 = illimité
  uses        Int      @default(0)
  maxAge      Int      @default(0)  // secondes, 0 = permanent
  temporary   Boolean  @default(false)
  expiresAt   DateTime?
  createdAt   DateTime @default(now())

  server      Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

// ─── BANS ────────────────────────────────────────────────────────────────────

model Ban {
  serverId String
  userId   String
  reason   String?
  bannedAt DateTime @default(now())
  server   Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)

  @@id([serverId, userId])
}

// ─── WEBHOOKS ────────────────────────────────────────────────────────────────

model Webhook {
  id        String   @id @default(cuid())
  name      String
  avatarUrl String?
  token     String   @unique @default(cuid())
  channelId String
  serverId  String
  createdAt DateTime @default(now())

  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  server    Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
  messages  Message[]
}

// ─── EMOJIS & AUTOCOLLANTS CUSTOM ────────────────────────────────────────────

model CustomEmoji {
  id        String   @id @default(cuid())
  name      String
  url       String
  animated  Boolean  @default(false)
  serverId  String
  createdAt DateTime @default(now())

  server    Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

model CustomSticker {
  id          String   @id @default(cuid())
  name        String
  description String?
  url         String
  format      StickerFormat @default(PNG)
  serverId    String
  createdAt   DateTime @default(now())

  server      Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

enum StickerFormat {
  PNG
  APNG
  LOTTIE
  GIF
}

// ─── SESSIONS VOCALES ────────────────────────────────────────────────────────

model VoiceSession {
  id         String   @id @default(cuid())
  userId     String
  channelId  String
  joinedAt   DateTime @default(now())
  leftAt     DateTime?
  deaf       Boolean  @default(false)
  mute       Boolean  @default(false)
  selfDeaf   Boolean  @default(false)
  selfMute   Boolean  @default(false)
  selfVideo  Boolean  @default(false)
  streaming  Boolean  @default(false)

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel    Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
}

// ─── NOTES UTILISATEUR ───────────────────────────────────────────────────────

model UserNote {
  noterId String
  notedId String
  content String  @db.Text
  noter   User    @relation("noter", fields: [noterId], references: [id], onDelete: Cascade)
  noted   User    @relation("noted", fields: [notedId], references: [id], onDelete: Cascade)

  @@id([noterId, notedId])
}

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  serverId    String
  actorId     String?
  targetId    String?
  action      AuditAction
  changes     Json?
  reason      String?
  createdAt   DateTime @default(now())

  server      Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

enum AuditAction {
  GUILD_UPDATE
  CHANNEL_CREATE
  CHANNEL_UPDATE
  CHANNEL_DELETE
  CHANNEL_OVERWRITE_CREATE
  CHANNEL_OVERWRITE_UPDATE
  CHANNEL_OVERWRITE_DELETE
  MEMBER_KICK
  MEMBER_BAN_ADD
  MEMBER_BAN_REMOVE
  MEMBER_UPDATE
  MEMBER_ROLE_UPDATE
  MEMBER_MOVE
  MEMBER_DISCONNECT
  BOT_ADD
  ROLE_CREATE
  ROLE_UPDATE
  ROLE_DELETE
  INVITE_CREATE
  INVITE_UPDATE
  INVITE_DELETE
  WEBHOOK_CREATE
  WEBHOOK_UPDATE
  WEBHOOK_DELETE
  EMOJI_CREATE
  EMOJI_UPDATE
  EMOJI_DELETE
  STICKER_CREATE
  STICKER_UPDATE
  STICKER_DELETE
  MESSAGE_DELETE
  MESSAGE_BULK_DELETE
  MESSAGE_PIN
  MESSAGE_UNPIN
}

// ─── ÉVÉNEMENTS PLANIFIÉS ────────────────────────────────────────────────────

model ScheduledEvent {
  id          String   @id @default(cuid())
  serverId    String
  channelId   String?
  name        String
  description String?
  coverUrl    String?
  startTime   DateTime
  endTime     DateTime?
  status      EventStatus @default(SCHEDULED)
  entityType  EventEntityType
  location    String?
  creatorId   String?
  createdAt   DateTime @default(now())

  server      Server   @relation(fields: [serverId], references: [id], onDelete: Cascade)
}

enum EventStatus {
  SCHEDULED
  ACTIVE
  COMPLETED
  CANCELED
}

enum EventEntityType {
  STAGE_INSTANCE
  VOICE
  EXTERNAL
}
```

---

## 4. SYSTÈME DE PERMISSIONS (Bitfield comme Discord)

Crée le fichier `lib/permissions.ts` avec le système complet :

```typescript
// lib/permissions.ts

export const Permissions = {
  // Permissions générales
  CREATE_INSTANT_INVITE:      1n << 0n,
  KICK_MEMBERS:               1n << 1n,
  BAN_MEMBERS:                1n << 2n,
  ADMINISTRATOR:              1n << 3n,
  MANAGE_CHANNELS:            1n << 4n,
  MANAGE_GUILD:               1n << 5n,
  ADD_REACTIONS:              1n << 6n,
  VIEW_AUDIT_LOG:             1n << 7n,
  PRIORITY_SPEAKER:           1n << 8n,
  STREAM:                     1n << 9n,
  VIEW_CHANNEL:               1n << 10n,

  // Permissions messages
  SEND_MESSAGES:              1n << 11n,
  SEND_TTS_MESSAGES:          1n << 12n,
  MANAGE_MESSAGES:            1n << 13n,
  EMBED_LINKS:                1n << 14n,
  ATTACH_FILES:               1n << 15n,
  READ_MESSAGE_HISTORY:       1n << 16n,
  MENTION_EVERYONE:           1n << 17n,
  USE_EXTERNAL_EMOJIS:        1n << 18n,
  VIEW_GUILD_INSIGHTS:        1n << 19n,

  // Permissions vocales
  CONNECT:                    1n << 20n,
  SPEAK:                      1n << 21n,
  MUTE_MEMBERS:               1n << 22n,
  DEAFEN_MEMBERS:             1n << 23n,
  MOVE_MEMBERS:               1n << 24n,
  USE_VAD:                    1n << 25n,

  // Gestion
  CHANGE_NICKNAME:            1n << 26n,
  MANAGE_NICKNAMES:           1n << 27n,
  MANAGE_ROLES:               1n << 28n,
  MANAGE_WEBHOOKS:            1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS:  1n << 31n,

  // Threads & avancé
  CREATE_PUBLIC_THREADS:      1n << 35n,
  CREATE_PRIVATE_THREADS:     1n << 36n,
  USE_EXTERNAL_STICKERS:      1n << 37n,
  SEND_MESSAGES_IN_THREADS:   1n << 38n,
  MODERATE_MEMBERS:           1n << 40n,
} as const;

export type PermissionKey = keyof typeof Permissions;

export function hasPermission(
  memberPermissions: bigint,
  permission: bigint
): boolean {
  if ((memberPermissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
  return (memberPermissions & permission) === permission;
}

export function computeMemberPermissions(
  member: { roles: { role: { permissions: bigint } }[] },
  everyoneRole: { permissions: bigint }
): bigint {
  let permissions = everyoneRole.permissions;
  for (const { role } of member.roles) {
    permissions |= role.permissions;
  }
  return permissions;
}

export function computeChannelPermissions(
  basePermissions: bigint,
  overwrites: { type: 'ROLE' | 'MEMBER'; targetId: string; allow: bigint; deny: bigint }[],
  memberRoleIds: string[],
  memberId: string
): bigint {
  if ((basePermissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return basePermissions;

  let allow = 0n;
  let deny = 0n;

  // @everyone overwrite
  const everyoneOverwrite = overwrites.find(o => o.type === 'ROLE' && o.targetId === 'everyone');
  if (everyoneOverwrite) {
    deny |= everyoneOverwrite.deny;
    allow |= everyoneOverwrite.allow;
  }

  // Role overwrites
  for (const roleId of memberRoleIds) {
    const roleOverwrite = overwrites.find(o => o.type === 'ROLE' && o.targetId === roleId);
    if (roleOverwrite) {
      deny |= roleOverwrite.deny;
      allow |= roleOverwrite.allow;
    }
  }

  // Member overwrite
  const memberOverwrite = overwrites.find(o => o.type === 'MEMBER' && o.targetId === memberId);
  if (memberOverwrite) {
    deny |= memberOverwrite.deny;
    allow |= memberOverwrite.allow;
  }

  return (basePermissions & ~deny) | allow;
}
```

---

## 5. LISTE EXHAUSTIVE DES FONCTIONNALITÉS À IMPLÉMENTER

### 5.1 — AUTHENTIFICATION & COMPTE

- [ ] Page de connexion (email + mot de passe)
- [ ] Page d'inscription (username, email, mot de passe, date de naissance)
- [ ] Validation des formulaires (Zod)
- [ ] Session persistante (cookie Supabase)
- [ ] Déconnexion
- [ ] Middleware de protection des routes (`middleware.ts`)
- [ ] Réinitialisation de mot de passe (email Supabase)
- [ ] Vérification d'email à l'inscription

---

### 5.2 — PARAMÈTRES UTILISATEUR (panneau complet, onglets)

#### Onglet "Mon compte"
- [ ] Changer le nom d'utilisateur (username)
- [ ] Changer le nom affiché (display name / pseudo)
- [ ] Changer l'email
- [ ] Changer le mot de passe
- [ ] Télécharger un avatar (Supabase Storage, crop circulaire)
- [ ] Supprimer l'avatar
- [ ] Voir le tag (username#0000)
- [ ] Zone de danger : supprimer le compte

#### Onglet "Profil"
- [ ] Photo de bannière de profil (upload image, Supabase Storage)
- [ ] Couleur de profil (color picker, utilisée si pas de bannière)
- [ ] Biographie (max 190 caractères, rich text léger : gras, italique, lien)
- [ ] Pronoms (champ libre)
- [ ] Effets de profil : liste d'effets visuels animés CSS (pas Nitro, tout gratuit). Effets disponibles :
  - `confetti` — confettis qui tombent
  - `snow` — neige
  - `fire` — flammes en bas du profil
  - `stars` — étoiles qui clignotent
  - `aurora` — fond aurora borealis
  - `matrix` — caractères qui tombent
  - `bubbles` — bulles qui montent
  - `none` — aucun effet
- [ ] Aperçu en temps réel de la carte de profil

#### Onglet "Confidentialité & Sécurité"
- [ ] Contrôle des DMs (qui peut m'envoyer des DMs : tout le monde, amis seulement, personne)
- [ ] Afficher le statut "En ligne" (activer/désactiver)
- [ ] Autoriser les demandes d'amis (tout le monde, amis d'amis, personne)
- [ ] Filtrage des messages explicites

#### Onglet "Apparence"
- [ ] Thème sombre / thème clair
- [ ] Taille des messages (confortable / compact)
- [ ] Taille de police (slider 12-20px)
- [ ] Zoom de l'interface

#### Onglet "Notifications"
- [ ] Activer/désactiver les notifications desktop
- [ ] Sons : activer/désactiver chaque son (message, DM, join vocal, leave vocal)
- [ ] Notification quand mentionné @moi
- [ ] Notification sur tous les messages

#### Onglet "Voix & Vidéo"
- [ ] Sélection du microphone (liste des devices)
- [ ] Sélection des écouteurs/haut-parleurs
- [ ] Volume du micro (slider)
- [ ] Volume de sortie (slider)
- [ ] Suppression de bruit (activer/désactiver)
- [ ] Test de micro
- [ ] Sélection de caméra

#### Onglet "Accessibilité"
- [ ] Réduire les animations
- [ ] Mode contraste élevé
- [ ] Taille des images

#### Onglet "Langue"
- [ ] Sélection de la langue de l'interface (FR, EN, ES, DE, PT, IT)

---

### 5.3 — SYSTÈME D'AMIS

- [ ] Onglet "Amis" dans la sidebar gauche (icône Distollec)
- [ ] Sous-onglets : Tous, En ligne, En attente, Bloqués
- [ ] Ajouter un ami (par username#tag ou username si tag 0)
- [ ] Envoyer une demande d'ami
- [ ] Accepter / refuser une demande d'ami
- [ ] Supprimer un ami
- [ ] Bloquer un utilisateur
- [ ] Débloquer un utilisateur
- [ ] Voir le profil d'un ami (modal)
- [ ] Indicateur de statut (vert=online, jaune=idle, rouge=dnd, gris=offline)
- [ ] Ouvrir un DM depuis la liste d'amis
- [ ] Lancer un appel vocal (DM) depuis la liste d'amis

---

### 5.4 — MESSAGES PRIVÉS (DMs)

- [ ] Ouvrir un DM avec un ami
- [ ] Historique des DMs dans la sidebar gauche
- [ ] Fermer un DM de la sidebar (sans supprimer)
- [ ] Épingler un message dans un DM
- [ ] Créer un DM de groupe (max 10 personnes)
  - [ ] Nommer le groupe
  - [ ] Changer l'icône du groupe
  - [ ] Ajouter/retirer des participants
  - [ ] Quitter le groupe
  - [ ] Si propriétaire, transférer la propriété
- [ ] Voir les membres d'un DM de groupe
- [ ] Panneau d'informations du DM (bouton ①) avec : profil, note sur l'utilisateur, DMs communs
- [ ] Note privée sur un utilisateur (seulement toi peux la lire)

---

### 5.5 — MESSAGERIE (salons texte & DMs)

- [ ] Affichage des messages avec regroupement (messages du même auteur dans les 5 min regroupés)
- [ ] Envoi de messages (Entrée pour envoyer, Shift+Entrée pour retour à la ligne)
- [ ] Markdown léger : **gras**, *italique*, ~~barré~~, `code inline`, ```bloc de code```, > citation, # Titre, ## Titre2
- [ ] Mentions : @utilisateur, @rôle, @here, @everyone
- [ ] Autocomplétion des mentions (typing @)
- [ ] Autocomplétion des emojis (typing :)
- [ ] Autocomplétion des channels (typing #)
- [ ] Envoi de fichiers / images (drag & drop ou bouton +)
- [ ] Aperçu des images dans le chat
- [ ] Aperçu des liens (embeds automatiques pour URLs)
- [ ] Réactions (emoji picker, ajouter/retirer, compteur, tooltip avec noms)
- [ ] Répondre à un message (bouton reply, affichage de la référence)
- [ ] Modifier un message (propre seulement, Escape pour annuler)
- [ ] Supprimer un message (propre ou si MANAGE_MESSAGES)
- [ ] Épingler un message (MANAGE_MESSAGES)
- [ ] Voir les messages épinglés (bouton dans le header)
- [ ] Copier le texte d'un message
- [ ] Copier le lien du message
- [ ] Marquer comme non lu
- [ ] Indicateur de frappe (typing indicator, "X est en train d'écrire…")
- [ ] Indicateur de non-lu (badge rouge, trait de séparation "NOUVEAUX MESSAGES")
- [ ] Scroll infini (charger les messages plus anciens en scrollant vers le haut)
- [ ] Jump to present (bouton flottant si on est loin du bas)
- [ ] Saut vers un message épinglé ou mentionné
- [ ] Autocollants (sélecteur d'autocollants custom du serveur + pack de base)
- [ ] Mode compact et mode confortable (paramètre apparence)
- [ ] Recherche de messages (icône loupe dans le header) :
  - [ ] Filtres : de, dans, avant, après, mention, a: (pièce jointe), épinglé
- [ ] Message système (entrée membre, changement de nom de salon, etc.)

---

### 5.6 — SALONS VOCAUX

- [ ] Rejoindre un salon vocal (clic)
- [ ] Quitter le salon vocal (bouton déconnexion en bas)
- [ ] Affichage des participants dans le salon (sidebar canal + vignettes)
- [ ] Mute micro (bouton, raccourci clavier)
- [ ] Sourdine (deaf)
- [ ] Partage d'écran (screen share via WebRTC)
- [ ] Caméra vidéo
- [ ] Notification audio (son de join/leave)
- [ ] Voir qui parle (indicator visuel glowing sur la vignette)
- [ ] Indicateur de connexion (latence, qualité)
- [ ] Volume individuel par participant (clic droit)
- [ ] Sourdiner un participant (permissions)
- [ ] Éjecter un participant (permissions MOVE_MEMBERS)
- [ ] Limiter le nombre d'utilisateurs dans un vocal (userLimit)
- [ ] Panneau "Voix connectée" en bas à gauche avec :
  - [ ] Nom du salon et serveur
  - [ ] Bouton caméra, screen share, mute, sourdine, déconnecter
  - [ ] Signal qualité réseau

**Implémentation vocale (LiveKit) :**
```typescript
// app/api/voice/token/route.ts
import { AccessToken } from 'livekit-server-sdk';

export async function POST(req: Request) {
  const { roomName, participantName, userId } = await req.json();

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: userId, name: participantName }
  );

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return Response.json({ token: await at.toJwt() });
}
```

---

### 5.7 — SERVEURS

#### Création de serveur
- [ ] Modal "Créer un serveur" :
  - [ ] Depuis un template (Jeux, Études, Amis, Créateurs, etc.)
  - [ ] Serveur vide
  - [ ] Choisir une icône (upload)
  - [ ] Nom du serveur
- [ ] Rejoindre un serveur via lien d'invitation
- [ ] Rejoindre via URL vanity

#### Sidebar serveur
- [ ] Header serveur (clic → menu déroulant) avec :
  - [ ] Boost du serveur (désactivé, bouton visible mais non fonctionnel car pas Nitro)
  - [ ] Inviter des gens
  - [ ] Paramètres du serveur
  - [ ] Créer un salon
  - [ ] Créer une catégorie
  - [ ] Quitter le serveur
- [ ] Liste des catégories (pliables/dépliables)
- [ ] Liste des salons par catégorie
- [ ] Drag & drop pour réorganiser salons et catégories
- [ ] Compteur de membres en ligne

#### Dans un salon texte (header)
- [ ] Nom du salon + topic
- [ ] Bouton : Fil d'actualité, Épingles, Membres, Recherche, Boîte de réception

---

### 5.8 — PARAMÈTRES DE SERVEUR (onglets complets)

Accessible via "Paramètres du serveur" → fenêtre plein écran avec sidebar d'onglets.

#### Vue d'ensemble
- [ ] Nom du serveur
- [ ] Icône du serveur (upload, crop)
- [ ] Bannière du serveur (upload)
- [ ] Image de splash (fond écran invitation)
- [ ] Description du serveur
- [ ] Langue du serveur
- [ ] Niveau de vérification (Aucun, Faible, Moyen, Élevé, Très élevé)
- [ ] Filtre de contenu explicite
- [ ] Notifications par défaut
- [ ] URL personnalisée (vanity URL)
- [ ] Salon système (messages d'arrivée, boosts)
- [ ] Salon des règles
- [ ] Salon des mises à jour

#### Rôles
- [ ] Lister tous les rôles (par position)
- [ ] Créer un rôle
- [ ] Supprimer un rôle
- [ ] Réorganiser les rôles (drag & drop)
- [ ] Éditer un rôle :
  - [ ] Nom
  - [ ] Couleur (color picker 6 couleurs Discord + roue de couleur libre)
  - [ ] Icône du rôle (upload image)
  - [ ] Afficher séparément (hoist)
  - [ ] Mentionnable
  - [ ] Chaque permission (toggle individuel par catégorie) :
    - Permissions générales
    - Permissions de membres
    - Permissions de salon texte
    - Permissions de salon vocal
    - Permissions avancées
- [ ] Voir les membres ayant un rôle
- [ ] Ajouter un membre à un rôle

#### Salons
- [ ] Lister tous les salons et catégories
- [ ] Créer un salon (texte, vocal, annonce, forum)
- [ ] Créer une catégorie
- [ ] Supprimer salon/catégorie
- [ ] Éditer un salon :
  - [ ] Nom
  - [ ] Topic (description)
  - [ ] NSFW (toggle)
  - [ ] Mode lent (slow mode)
  - [ ] Salon privé (toggle — visible seulement par certains rôles)
  - [ ] Permissions du salon (overwrites par rôle et par membre)
- [ ] Éditer un salon vocal :
  - [ ] Nom
  - [ ] Débit binaire (8 kbps → 96 kbps)
  - [ ] Limite d'utilisateurs (0 = illimité)
  - [ ] Région (auto)
  - [ ] Permissions du salon vocal

#### Membres
- [ ] Lister tous les membres (avatar, username, rôles, date d'arrivée)
- [ ] Rechercher un membre
- [ ] Clic droit sur un membre → menu contextuel :
  - [ ] Voir le profil
  - [ ] Envoyer un message
  - [ ] Changer le pseudo (nickname)
  - [ ] Gérer les rôles (ajouter/retirer)
  - [ ] Timeout (durée 60s, 5min, 10min, 1h, 1j, 1sem)
  - [ ] Expulser (kick)
  - [ ] Bannir
- [ ] Pagination (50 par page)

#### Invitations
- [ ] Lister toutes les invitations actives
- [ ] Créer une invitation (salon, durée, max utilisations, temporaire)
- [ ] Copier le lien d'invitation
- [ ] Révoquer une invitation
- [ ] Voir les stats (utilisations/max)

#### Emojis
- [ ] Lister les emojis custom (max 50 statiques, 50 animés en free)
- [ ] Upload un emoji (nom, image PNG/GIF)
- [ ] Supprimer un emoji
- [ ] Renommer un emoji
- [ ] Restreindre un emoji à certains rôles

#### Autocollants
- [ ] Lister les autocollants custom (max 5 en free)
- [ ] Upload un autocollant (nom, description, image PNG/APNG/GIF)
- [ ] Supprimer un autocollant
- [ ] Renommer un autocollant

#### Sons custom
- [ ] Upload des sons custom pour le serveur (court, < 5 secondes)
- [ ] Lister les sons
- [ ] Supprimer les sons

#### Webhooks
- [ ] Lister les webhooks
- [ ] Créer un webhook (nom, avatar, salon cible)
- [ ] Modifier un webhook
- [ ] Copier l'URL du webhook
- [ ] Supprimer un webhook
- [ ] Tester un webhook (envoyer un message test)

#### Intégrations
- [ ] Lister les webhooks (vue condensée)
- [ ] Section "Bots" (affichage seulement)

#### Journal d'audit
- [ ] Lister les actions (avec filtre par type d'action et par membre)
- [ ] Infos : qui, quoi, quand, pourquoi (raison)
- [ ] Pagination

#### Bannissements
- [ ] Lister les membres bannis (avec raison)
- [ ] Débannir un membre
- [ ] Rechercher dans les bans

#### Événements planifiés
- [ ] Créer un événement (nom, description, date début/fin, salon ou lieu externe, image)
- [ ] Lister les événements à venir
- [ ] Modifier un événement
- [ ] Supprimer un événement
- [ ] Marquer comme terminé

---

### 5.9 — PANNEAU DES MEMBRES (sidebar droite)

- [ ] Toggle afficher/masquer (bouton header)
- [ ] Section "En ligne" avec membres groupés par rôle hoisted
- [ ] Section "Hors ligne"
- [ ] Clic sur un membre → popup de profil

---

### 5.10 — PROFIL UTILISATEUR (modal / popup)

- [ ] Avatar (avec effet animé si configuré)
- [ ] Bannière / couleur de fond
- [ ] Nom affiché + tag
- [ ] Badge "Membre depuis" (date Distollec)
- [ ] Badge "Sur ce serveur depuis" (date join)
- [ ] Bio
- [ ] Pronoms
- [ ] Rôles dans le serveur actuel (petits badges colorés)
- [ ] Note privée (champ texte, sauvegardée seulement pour toi)
- [ ] Boutons : Envoyer message, Ajouter ami, Bloquer, (mod : Kick, Ban, Timeout)
- [ ] Onglet "DMs communs"
- [ ] Onglet "Serveurs communs"
- [ ] Statut personnalisé avec emoji

---

### 5.11 — BARRE D'UTILISATEUR (bottom left)

- [ ] Avatar avec indicateur de statut
- [ ] Username + tag
- [ ] Statut custom (si défini)
- [ ] Bouton Micro (mute/unmute)
- [ ] Bouton Son (sourdine)
- [ ] Bouton Paramètres utilisateur

---

### 5.12 — STATUT & PRÉSENCE (Supabase Realtime)

- [ ] Présence en ligne en temps réel (Supabase Presence)
- [ ] Changer son statut : En ligne, Absent, Ne pas déranger, Invisible
- [ ] Statut personnalisé : texte + emoji unicode (pas de custom emoji)
- [ ] Effacer le statut personnalisé
- [ ] Disparaître après (30min, 1h, Aujourd'hui, Ne jamais effacer)

---

### 5.13 — RECHERCHE GLOBALE (Cmd+K / Ctrl+K)

- [ ] Raccourci Ctrl+K ou Cmd+K
- [ ] Chercher des serveurs, salons, membres, messages
- [ ] Navigation rapide clavier (↑↓ Enter)

---

### 5.14 — NOTIFICATIONS

- [ ] Badge rouge sur l'icône serveur (messages non lus)
- [ ] Trait de non-lu dans un salon
- [ ] Notification desktop (API Notification si autorisé)
- [ ] Sons (définis dans les paramètres) :
  - `sounds/message.mp3`
  - `sounds/dm.mp3`
  - `sounds/mention.mp3`
  - `sounds/voice-join.mp3`
  - `sounds/voice-leave.mp3`
  - `sounds/deafen.mp3`
  - `sounds/undeafen.mp3`
  - `sounds/mute.mp3`
  - `sounds/unmute.mp3`
- [ ] Paramètres de notifications par serveur (overrider les paramètres globaux)
- [ ] Paramètres de notifications par salon

---

## 6. DESIGN SYSTÈME — CHARTE GRAPHIQUE DISTOLLEC

### Palette de couleurs (CSS variables dans globals.css)

```css
:root {
  /* Fonds principaux (thème sombre par défaut) */
  --bg-primary:       #1e1f22;   /* corps principal */
  --bg-secondary:     #2b2d31;   /* sidebar droite/gauche */
  --bg-tertiary:      #232428;   /* sidebar serveurs */
  --bg-quaternary:    #383a40;   /* hover */
  --bg-floating:      #111214;   /* modals, dropdowns */

  /* Accents */
  --accent:           #5865f2;   /* Bleu Distollec */
  --accent-hover:     #4752c4;
  --accent-low:       rgba(88,101,242,0.15);
  --green:            #23a55a;   /* statut en ligne */
  --yellow:           #f0b232;   /* statut absent */
  --red:              #f23f43;   /* statut dnd / danger */
  --gray:             #80848e;   /* statut offline */
  --white:            #ffffff;
  --white-off:        #dbdee1;

  /* Texte */
  --text-primary:     #f2f3f5;
  --text-secondary:   #b5bac1;
  --text-muted:       #80848e;
  --text-link:        #00a8fc;

  /* Séparateurs */
  --separator:        rgba(255,255,255,0.06);

  /* Inputs */
  --input-bg:         #1e1f22;
  --input-border:     rgba(0,0,0,0.3);
}

/* Thème clair */
[data-theme="light"] {
  --bg-primary:       #ffffff;
  --bg-secondary:     #f2f3f5;
  --bg-tertiary:      #e3e5e8;
  --bg-quaternary:    #d7d9dc;
  --bg-floating:      #ffffff;
  --text-primary:     #060607;
  --text-secondary:   #4e5058;
  --text-muted:       #80848e;
  --separator:        rgba(0,0,0,0.08);
}
```

### Typographie
- **Police principale** : `'DM Sans'` (Google Fonts) — moderne, propre, unique
- **Police code** : `'JetBrains Mono'` (Google Fonts)
- Import dans `app/layout.tsx`

```tsx
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400','500','600','700'] });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400','500'] });
```

### Iconographie — Phosphor Icons

Utilise **uniquement** Phosphor Icons (`@phosphor-icons/react`). Variante **Regular** par défaut, **Fill** pour les états actifs.

Mapping des icônes principales :
```
Accueil DMs           → <House />
Amis                  → <Users />
Ajouter ami           → <UserPlus />
Bloquer               → <Prohibit />
Serveur (sidebar)     → icône personnalisée (initiales)
Créer serveur         → <Plus />
Rejoindre serveur     → <MagnifyingGlass />
Salon texte           → <Hash />
Salon vocal           → <SpeakerHigh />
Salon annonce         → <Megaphone />
Salon forum           → <ChatTeardropText />
Catégorie (plié)      → <CaretRight />
Catégorie (déplié)    → <CaretDown />
Paramètres           → <Gear />
Profil                → <UserCircle />
Notifications         → <Bell />
Apparence             → <PaintBrush />
Voix & Vidéo          → <Microphone />
Confidentialité       → <ShieldCheck />
Langue                → <Globe />
Accessibilité         → <Eye />
Rôles                 → <Crown />
Membres               → <Users />
Emojis                → <Smiley />
Autocollants          → <Sticker />
Webhooks              → <Webhooks /> ou <ArrowsOut />
Journal d'audit       → <ClipboardText />
Bans                  → <Gavel />
Invitations           → <Link />
Épingles              → <PushPin />
Recherche             → <MagnifyingGlass />
Modifier message      → <PencilSimple />
Supprimer message     → <Trash />
Répondre              → <ArrowBendUpLeft />
Réaction              → <Smiley />
Mute micro            → <MicrophoneSlash />
Sourdine              → <SpeakerSlash />
Déconnecter           → <PhoneDisconnect />
Partage écran         → <MonitorPlay />
Vidéo                 → <VideoCamera />
Envoyer               → <PaperPlaneTilt />
Fichier               → <Paperclip />
Gif                   → <FilmStrip />
Fermer                → <X />
Chevron bas           → <CaretDown />
Menu                  → <List />
Corbeille             → <Trash />
Vérifier              → <Check />
```

### Layout principal

```
┌─────────────────────────────────────────────────────────┐
│ 72px │    240px     │         flex-1         │  240px   │
│      │              │                        │          │
│Srvrs │  Chan.List   │    Zone messages       │ Membres  │
│      │  ou DM list  │    + Input             │ (toggle) │
│      │              │                        │          │
│      ├──────────────┤                        │          │
│      │ Barre user   │                        │          │
└──────┴──────────────┴────────────────────────┴──────────┘
```

- **Sidebar serveurs** (72px) : bg-tertiary, icônes rondes des serveurs, bouton accueil, séparateur, bouton créer/rejoindre
- **Sidebar canaux** (240px) : bg-secondary, header serveur, liste catégories + canaux
- **Zone principale** : bg-primary, header canal, messages, input
- **Sidebar membres** (240px) : bg-secondary, toggle, liste membres groupés par rôle

### Composants UI détaillés

#### Icône serveur (ServerIcon)
```tsx
// Rond de 48px, clip-path circle, image ou dégradé avec initiales
// Au hover : passe de rond à un arrondi moins prononcé (border-radius 16px)
// Si actif : indicateur à gauche (pill blanc)
// Si non-lu : indicateur à gauche (pill blanc petit)
// Transition smooth 200ms
```

#### Message
```tsx
// Mode confortable :
// - Avatar 40px à gauche, nom + timestamp sur la même ligne, texte dessous
// - Messages groupés : pas d'avatar, timestamp au hover à la place
// Mode compact :
// - Tout sur une ligne, avatar 16px
// Au hover : bg-quaternary, boutons d'action apparaissent à droite
// Réactions : flex-wrap, gap 4px, fond bg-quaternary, arrondi pill
```

#### Input message
```tsx
// bg-quaternary, border-radius 8px, padding 12px 16px
// Boutons à gauche : + (fichier), gif
// Boutons à droite : emoji picker, autocollant, cadeau (désactivé)
// Placeholder : "Écrire dans #nom-du-salon"
// Auto-grow (max 50% de la hauteur de la fenêtre)
```

#### Modal
```tsx
// bg-floating, border-radius 8px, backdrop blur + overlay noir 85%
// Animation : scale 0.9 → 1 + opacity 0 → 1 (100ms ease-out)
// Fermeture : Escape, clic overlay
```

#### Context menu
```tsx
// bg-floating, border-radius 6px, shadow xl, padding 4px
// Items : 32px height, border-radius 4px, hover bg-quaternary
// Séparateur : 1px separator color
// Danger items : text-red, hover bg-red/10
```

---

## 7. REAL-TIME (Supabase Realtime)

Tout le temps réel passe par Supabase Realtime. Architecture :

```typescript
// hooks/useSupabaseRealtime.ts

// Canal par salon texte :
// supabase.channel(`channel:${channelId}`)
//   .on('broadcast', { event: 'new_message' }, handler)
//   .on('broadcast', { event: 'edit_message' }, handler)
//   .on('broadcast', { event: 'delete_message' }, handler)
//   .on('broadcast', { event: 'typing' }, handler)
//   .subscribe()

// Canal de présence par serveur :
// supabase.channel(`presence:${serverId}`)
//   .on('presence', { event: 'sync' }, handler)
//   .on('presence', { event: 'join' }, handler)
//   .on('presence', { event: 'leave' }, handler)
//   .subscribe()

// À chaque envoi de message via API, broadcaster sur le canal Supabase
```

---

## 8. VARIABLES D'ENVIRONNEMENT (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # pour les opérations admin côté serveur

# Database (connexion Prisma via Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# LiveKit (voix)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=secret...
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud

# App
NEXTAUTH_URL=https://distollec.vercel.app
NEXT_PUBLIC_APP_URL=https://distollec.vercel.app
```

---

## 9. MIDDLEWARE DE PROTECTION DES ROUTES

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const isAuthPage = req.nextUrl.pathname.startsWith('/login') ||
                     req.nextUrl.pathname.startsWith('/register');

  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/channels/@me', req.url));
  }
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sounds).*)'],
};
```

---

## 10. STORES ZUSTAND

```typescript
// store/useUserStore.ts
interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  status: UserStatus;
  setStatus: (status: UserStatus) => void;
  customStatus: string | null;
  setCustomStatus: (s: string | null) => void;
}

// store/useServerStore.ts
interface ServerStore {
  servers: Server[];
  activeServerId: string | null;
  activeChannelId: string | null;
  setServers: (servers: Server[]) => void;
  setActiveServer: (id: string) => void;
  setActiveChannel: (id: string) => void;
}

// store/useVoiceStore.ts
interface VoiceStore {
  activeRoomId: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  participants: VoiceParticipant[];
  join: (roomId: string) => void;
  leave: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

// store/useUIStore.ts
interface UIStore {
  theme: 'dark' | 'light';
  memberSidebarOpen: boolean;
  settingsOpen: boolean;
  settingsTab: string;
  activeModal: string | null;
  modalProps: Record<string, unknown>;
  openModal: (modal: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}
```

---

## 11. COMPOSANT VOCAL LIVEKIT

```typescript
// components/voice/VoiceRoom.tsx
'use client';
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
  useLocalParticipant,
  AudioConference,
} from '@livekit/components-react';
import '@livekit/components-styles';

export function VoiceRoom({ channelId, userId, displayName }: {
  channelId: string;
  userId: string;
  displayName: string;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/voice/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: `channel-${channelId}`,
        participantName: displayName,
        userId,
      }),
    })
    .then(r => r.json())
    .then(d => setToken(d.token));
  }, [channelId, userId, displayName]);

  if (!token) return <div>Connexion...</div>;

  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      token={token}
      audio={true}
      video={false}
      onDisconnected={() => useVoiceStore.getState().leave()}
    >
      <VoiceParticipantGrid />
      <VoiceControls />
    </LiveKitRoom>
  );
}
```

---

## 12. SYSTÈME D'INVITATIONS

```typescript
// app/api/servers/[serverId]/invites/route.ts
// POST : créer une invitation
// body : { channelId?, maxUses?, maxAge?, temporary? }
// génère un code aléatoire 8 chars (nanoid)
// retourne l'URL : https://distollec.vercel.app/invite/{code}

// GET : liste des invitations du serveur (MANAGE_GUILD requis)

// app/api/invites/[code]/route.ts
// GET : info sur l'invitation (nom serveur, membres, icône)
// POST : rejoindre le serveur via l'invitation
```

Page d'invitation (`app/invite/[code]/page.tsx`) :
- [ ] Afficher les infos du serveur (icône, nom, nb membres, en ligne)
- [ ] Bouton "Accepter l'invitation"
- [ ] Si déjà membre : rediriger
- [ ] Si lien expiré/invalide : message d'erreur

---

## 13. WEBHOOKS

```typescript
// Endpoint public pour recevoir un message via webhook :
// POST /api/webhooks/[webhookId]/[token]
// body Discord-compatible : { content, username, avatar_url, embeds }
// Crée un message dans le salon avec type webhook
```

---

## 14. ANIMATIONS & MICRO-INTERACTIONS (Framer Motion)

- [ ] Sidebar serveur : wobble sur drag & drop
- [ ] Modals : spring scale in/out
- [ ] Messages nouveaux : slide-up + fade-in
- [ ] Typing indicator : 3 dots bounce
- [ ] Hover sur icône serveur : border-radius animation
- [ ] Notification badge : pop animation
- [ ] Emoji picker : scale-in depuis le coin
- [ ] Panel paramètres : slide depuis la droite
- [ ] Toast notifications : slide depuis le bas

---

## 15. OPTIMISATIONS & BONNES PRATIQUES

### Performance
- [ ] `React.memo` sur `MessageItem`, `ServerListItem`, `ChannelItem`
- [ ] Virtualisation de la liste de messages (`@tanstack/react-virtual`) pour les longs historiques
- [ ] Images avec `next/image` (lazy loading, blur placeholder)
- [ ] Routes dynamiques en Suspense avec skeleton loading
- [ ] Debounce sur le typing indicator (300ms)
- [ ] Throttle sur le scroll listener (100ms)

### Sécurité
- [ ] Sanitiser tout le markdown (DOMPurify)
- [ ] Vérifier les permissions côté serveur sur CHAQUE action
- [ ] Rate limiting sur les routes API sensibles (messages, invitations)
- [ ] Valider chaque body de requête avec Zod
- [ ] Les uploads : vérifier le type MIME et la taille côté serveur

### Accessibilité
- [ ] `aria-label` sur tous les boutons icônes
- [ ] Navigation clavier dans les modals (focus trap)
- [ ] Escape pour fermer les modals/menus
- [ ] Rôles ARIA sur la liste de messages (role="log")
- [ ] Skip to main content link

---

## 16. ORDRE DE DÉVELOPPEMENT SUGGÉRÉ

1. **Setup** : Next.js, Tailwind, Prisma, Supabase, TypeScript
2. **Auth** : Login, Register, Middleware, Session
3. **Layout principal** : Sidebar serveurs, sidebar canaux, zone principale
4. **Messagerie de base** : Envoi, affichage, temps réel Supabase
5. **DMs & Amis**
6. **Système de serveurs** (créer, rejoindre, quitter)
7. **Salons** (créer, supprimer, réorganiser)
8. **Rôles & Permissions** (bitfield complet)
9. **Paramètres utilisateur** (tous les onglets)
10. **Paramètres serveur** (tous les onglets)
11. **Salons vocaux** (LiveKit)
12. **Profils & customisation**
13. **Webhooks, Invitations, Audit log**
14. **Polish** : animations, sons, accessibilité, optimisations
15. **Déploiement Vercel**

---

## 17. PAGES & ROUTES

| Route | Description |
|-------|-------------|
| `/login` | Page de connexion |
| `/register` | Page d'inscription |
| `/channels/@me` | Page accueil amis/DMs |
| `/channels/@me/[conversationId]` | DM ou groupe |
| `/servers/[serverId]/[channelId]` | Salon d'un serveur |
| `/invite/[code]` | Page d'invitation |
| `/api/...` | Toutes les routes API |

---

## 18. NOTES FINALES POUR TRAE

1. **Ne jamais laisser un composant non câblé.** Si tu crées un bouton, il doit faire quelque chose.
2. **Tout le code est en TypeScript strict.** Pas de `any`, pas de `@ts-ignore`.
3. **Les permissions sont vérifiées côté serveur** (API routes) et côté client (pour masquer les UI).
4. **Le nom de l'application est "Distollec"** partout (title, meta, OG tags, etc.).
5. **Pas de mock data.** Tout est connecté à Supabase/Prisma.
6. **Les salons vocaux fonctionnent.** LiveKit est câblé, les tokens sont générés, les participants apparaissent.
7. **Le temps réel fonctionne.** Les messages arrivent sans refresh. Les indicateurs de frappe fonctionnent. La présence fonctionne.
8. **Le design est fidèle à Discord.** Flat, sombre, DM Sans, Phosphor Icons. Pas d'emojis comme icônes UI. Aucun autre pack d'icônes.
9. **Tout est déployable sur Vercel free tier** sans aucun service payant.
10. **Commence par `prisma db push` pour pousser le schéma sur Supabase**, puis seed avec un utilisateur test et un serveur test.

---

*Distollec — Cahier des charges complet. Version 1.0.0*
